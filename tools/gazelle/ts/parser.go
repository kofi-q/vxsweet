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

// TODO: Use tree-sitter to simplify these lookups:
var (
	//
	// Used to identify explicitly imported dependencies:
	//

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

	//
	// Used to identify implicitly required ambient type dependencies:
	//

	regexJestReference = regexp.MustCompile(
		`\s(?:` +
			strings.Join([]string{
				`jest\.\w+\(`,
				`test(:?\.each)?\(`,
				`(?:before|after)(?:Each|All)\(`,
				`expect(?:\.\w+)?\(`,
			}, "|") +
			`)`,
	)
	regexJestStyledComponents = regexp.MustCompile(`\.toHaveStyleRule\(`)
	regexJestImageSnapshot    = regexp.MustCompile(`\.toMatchImageSnapshot\(`)
	regexJestImageUtils       = regexp.MustCompile(
		`\.(?:toMatchImage|toMatchPdfSnapshot)\(`,
	)
	regexProcessEnv   = regexp.MustCompile(`\sprocess\.env(\.|\[])`)
	regexNodeTypes    = regexp.MustCompile(`\sNodeJS\..+`)
	regexKioskBrowser = regexp.MustCompile(
		`\s(?:KioskBrowser\.|window\.kiosk)`,
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

	if regexJestReference.Match([]byte(stringContent)) {
		imports["jest"] = true

		// Keeping detection simple for @testing-library/jest-dom for now and just
		// importing the types whenever we import `jest` types.
		imports["@testing-library/jest-dom"] = true
	}

	if regexJestStyledComponents.Match([]byte(stringContent)) {
		imports[ambientTypesImportJestStyledComponents] = true
	}

	if regexJestImageSnapshot.Match([]byte(stringContent)) {
		imports[ambientTypesImportJestImageSnapshot] = true
	}

	if regexJestImageUtils.Match([]byte(stringContent)) {
		imports[ambientTypesImportJestImageUtils] = true
	}

	if regexKioskBrowser.Match([]byte(stringContent)) {
		imports[ambientTypesImportKioskBrowser] = true
	}

	if regexProcessEnv.Match([]byte(stringContent)) {
		imports[ambientTypesImportEnv] = true
		imports["@types/node"] = true
	}

	if regexNodeTypes.Match([]byte(stringContent)) {
		imports["@types/node"] = true
	}

	return ParseResult{
		Imports: imports,
		Modules: []string{},
	}, []error{}
}
