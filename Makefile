# Makefile for the WordPress plugin WordPress Memory Usage

# Default goal and help message for the Makefile
.DEFAULT_GOAL := help

# Specify the shell to be used for executing the commands in this Makefile.
# In this case, it is set to /bin/bash.
SHELL := /bin/bash

# Base config file that should always exist
ConfigFile := .make/config.ini
# Optional override config file that may or may not exist, allowing for specific overrides
ConfigFileOverride := .make/config-overrides.ini
# Combine both config files into a single list for parsing, with the base config first and the override second
ParsedConfigFiles := $(ConfigFile) $(wildcard $(ConfigFileOverride))

# Extract all config values from $(ConfigFile) and export them as Makefile variables
ifneq ($(wildcard $(ConfigFile)),)
TMPFILE := $(shell mkdir -p $(dir $(ConfigFile)) && mktemp $(dir $(ConfigFile))/make_vars.XXXXXX)
$(shell awk -F= '/^\[/{gsub(/^^\[|\]$$/, "", $$0); section=$$0; next} /^[^#;].*=/ { key=$$1; val=$$0; sub(/^[^=]*=/, "", val); gsub(/^[ \t]+|[ \t]+$$/, "", val); gsub(/^[ \t]+|[ \t]+$$/, "", key); if(section=="") name=toupper(key); else name=toupper(section"__"key); gsub(/[^A-Z0-9_]/, "_", name); gsub(/[$$]/, "$$$$", val); printf "%s := %s\n", name, val }' $(ParsedConfigFiles) > $(TMPFILE))
include $(TMPFILE)
$(shell rm -f $(TMPFILE))

# Also capture the list of variable NAMES (for show-config output).
ConfigVars := $(shell awk -F= '/^\[/{gsub(/^^\[|\]$$/, "", $$0); section=$$0; next} /^[^#;].*=/ { key=$$1; gsub(/^[ \t]+|[ \t]+$$/, "", key); if(section=="") name=toupper(key); else name=toupper(section"__"key); gsub(/[^A-Z0-9_]/, "_", name); print name }' $(ParsedConfigFiles) | sort -u)
else
# Notify the user that no config file was found.
$(error Config file '$(ConfigFile)' not found. To configure the project, create '$(ConfigFile)')
endif

# Debug:
#    Show parsed config variables
.PHONY: show-config
show-config: show-parsed-config-files
	@echo "$(TEXT_BOLD)Parsed variables from parsed config files (NAME = VALUE):$(TEXT_RESET)"
	@echo ""
	@$(foreach var, $(ConfigVars), printf "%s = %s\n" "$(var)" "$($(var))";)
	@echo ""
	@$(VENV_CHECK)

# Debug:
#    Show which config files were parsed and in what order
#    Whether they were found or missing
#    Which variables were overridden in the override file (if present)
.PHONY: show-parsed-config-files
show-parsed-config-files:
	@echo ""
	@echo "$(TEXT_BOLD)Config files parsed (first -> last):$(TEXT_RESET)"
	@printf "  %s\n" $(ParsedConfigFiles)
	@echo ""
	@if [ -f "$(ConfigFile)" ]; then \
		echo "Base config: $(ConfigFile) (found)"; \
	else \
		echo "Base config: $(ConfigFile) (missing)"; \
	fi
	@if [ -f "$(ConfigFileOverride)" ]; then \
		echo "Override config (optional): $(ConfigFileOverride) (found)"; \
	else \
		echo "Override config (optional): $(ConfigFileOverride) (not present)"; \
	fi
	@echo ""
	@# Print variables that were overridden in the override file
	@{ \
		set -euo pipefail; \
		base="$(ConfigFile)"; \
		override="$(ConfigFileOverride)"; \
		base_tmp=$$(mktemp); \
		ovr_tmp=$$(mktemp); \
		awk -F= '/^\[/ {gsub(/^^\[|\]$$/, "", $$0); section=$$0; next} /^[^#;].*=/ { key=$$1; val=$$0; sub(/^[^=]*=/, "", val); gsub(/^[ \t]+|[ \t]+$$/, "", val); gsub(/^[ \t]+|[ \t]+$$/, "", key); if(section=="") name=toupper(key); else name=toupper(section"__"key); gsub(/[^A-Z0-9_]/, "_", name); printf "%s=%s\n", name, val }' "$$base" > "$$base_tmp"; \
		if [ -f "$$override" ]; then \
			awk -F= '/^\[/ {gsub(/^^\[|\]$$/, "", $$0); section=$$0; next} /^[^#;].*=/ { key=$$1; val=$$0; sub(/^[^=]*=/, "", val); gsub(/^[ \t]+|[ \t]+$$/, "", val); gsub(/^[ \t]+|[ \t]+$$/, "", key); if(section=="") name=toupper(key); else name=toupper(section"__"key); gsub(/[^A-Z0-9_]/, "_", name); printf "%s=%s\n", name, val }' "$$override" > "$$ovr_tmp"; \
			if [ -s "$$ovr_tmp" ]; then \
				echo "$(TEXT_UNDERLINE)Overridden variables:$(TEXT_RESET)"; \
				base_sorted="$$base_tmp.sorted"; \
				ovr_sorted="$$ovr_tmp.sorted"; \
				sort "$$base_tmp" > "$$base_sorted"; \
				sort "$$ovr_tmp" > "$$ovr_sorted"; \
				join -t= -o 0,1.2,2.2 "$$base_sorted" "$$ovr_sorted" 2>/dev/null | while IFS='=' read -r name baseval ovrval; do \
					if [ "$$baseval" != "$$ovrval" ]; then \
						echo "- $$name"; \
						echo "    Base: $$baseval"; \
						echo "    Override: $$ovrval"; \
						echo "    Final: $$ovrval"; \
						echo ""; \
					fi; \
				done; \
				# Report variables that exist only in the override (new variables) \
				only_ovr_tmp=$$(mktemp); \
				join -t= -v2 "$$base_sorted" "$$ovr_sorted" > "$$only_ovr_tmp" 2>/dev/null || true; \
				if [ -s "$$only_ovr_tmp" ]; then \
					echo "$(TEXT_UNDERLINE)New Variables (Only in Override):$(TEXT_RESET)"; \
					while IFS='=' read -r name val; do \
						echo "- $$name"; \
						echo "    Value: $$val"; \
						echo ""; \
					done < "$$only_ovr_tmp"; \
				fi; \
				rm -f "$$only_ovr_tmp"; \
			else \
				echo "  (Override config file present but no variables overridden)"; \
				echo ""; \
			fi; \
		else \
			echo "  (No override config file present)"; \
			echo ""; \
		fi; \
		rm -f "$$base_tmp" "$$ovr_tmp" "$$base_tmp.sorted" "$$ovr_tmp.sorted"; \
	}

# Help message for the Makefile
.PHONY: help
help::
	@echo "$(TEXT_BOLD)$(GENERAL__APPNAME_VERBOSE)$(TEXT_BOLD_END) Makefile"
	@echo ""
	@echo "$(TEXT_BOLD)Usage:$(TEXT_BOLD_END)"
	@echo "  make [command]"
	@echo ""
	@echo "$(TEXT_BOLD)Commands:$(TEXT_BOLD_END)"

# Catchall for unknown commands to fail gracefully
.DEFAULT:
	@true

# Include the configurations
include .make/conf.d/*.mk
