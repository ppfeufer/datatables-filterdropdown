.PHONY: lint-js
lint-js:
	@echo "Linting JavaScript files …"
	@npm run lint

.PHONY: minify-js
minify-js:
	@echo "Minifying JavaScript files …"
	@npm run minify

.PHONY: build
build:
	@echo "Building distributable files …"
	@npm run build

help::
	@echo "  $(TEXT_UNDERLINE)Development:$(TEXT_UNDERLINE_END)"
	@echo "    build                     Build distributable files (bundle + minify)"
	@echo "    lint-js                   Lint JavaScript files"
	@echo "    minify-js                 Minify JavaScript files"
	@echo ""
