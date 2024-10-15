package ts

import (
	"os"
	"path"
	"regexp"
	"strings"
)

type ParseResult struct {
	Imports map[string]bool
	Modules []string
}

var (
	regexReexport = regexp.MustCompile(
		`(?m:^ *\bexport(?:.|\n|\s)*?from ["'](.+?)["'])`,
	)
	regexStaticImport = regexp.MustCompile(
		`(?m:^ *\bimport(?:.|\n|\s)*?from ["'](.+?)["'])`,
	)
	regexJestMock = regexp.MustCompile(
		`(?m:^.*\bjest\.mock\(["'](.+?)["'])`,
	)
	regexSideEffectImport = regexp.MustCompile(
		`(?m:^ *\bimport ["'](.+?)["'])`,
	)
	regexDynamicImport = regexp.MustCompile(
		`\bimport\((?:\n|\s)*?["'](.+?)["'](?:\n|\s)*?\)`,
	)
	regexRequire = regexp.MustCompile(
		`\brequire(?:\.resolve)?\((?:\n|\s)*?["'](.+?)["'](?:\n|\s)*?\)`,
	)
)

type Parser interface {
	ParseSource(filePath, source string) (ParseResult, []error)
}

// Parse the passed file for import statements.
func ParseSourceFile(rootDir, filePath string) (ParseResult, []error) {
	content, err := os.ReadFile(path.Join(rootDir, filePath))
	if err != nil {
		return ParseResult{}, []error{err}
	}

	stringContent := string(content)

	imports := map[string]bool{}

	for _, reexport := range regexReexport.FindAllStringSubmatch(stringContent, -1) {
		moduleNameOrPath := reexport[1]
		if moduleNameOrPath == "" {
			continue
		}

		imports[moduleNameOrPath] = true
	}

	for _, staticImport := range regexStaticImport.FindAllStringSubmatch(stringContent, -1) {
		moduleNameOrPath := staticImport[1]
		if moduleNameOrPath == "" {
			continue
		}

		imports[moduleNameOrPath] = true
	}

	for _, jestMock := range regexJestMock.FindAllStringSubmatch(stringContent, -1) {
		moduleNameOrPath := jestMock[1]
		if moduleNameOrPath == "" {
			continue
		}

		imports[moduleNameOrPath] = true
	}

	for _, sideEffectImport := range regexSideEffectImport.FindAllStringSubmatch(stringContent, -1) {
		moduleNameOrPath := sideEffectImport[1]
		if moduleNameOrPath == "" {
			continue
		}

		imports[moduleNameOrPath] = true
	}

	for _, dynamicImport := range regexDynamicImport.FindAllStringSubmatch(stringContent, -1) {
		moduleNameOrPath := dynamicImport[1]
		if moduleNameOrPath == "" {
			continue
		}

		imports[moduleNameOrPath] = true
	}

	for _, require := range regexRequire.FindAllStringSubmatch(stringContent, -1) {
		moduleNameOrPath := require[1]
		if moduleNameOrPath == "" {
			continue
		}

		imports[moduleNameOrPath] = true
	}

	if !strings.Contains(filePath, ".test.") &&
		(strings.Contains(filePath, "test_utils") ||
			strings.Contains(filePath, "/test/") ||
			strings.Contains(filePath, "test-utils") ||
			strings.Contains(filePath, "/fixtures/") ||
			strings.Contains(filePath, "setUpJestTests.ts")) {
		imports["@types/jest"] = true
	}

	return ParseResult{
		Imports: imports,
		Modules: []string{},
	}, []error{}
}
