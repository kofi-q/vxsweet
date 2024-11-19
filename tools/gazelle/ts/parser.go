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
		`(?m:^ *\bexport(?:[^;]|\n|\s)*?from ["'](.+?)["'])`,
	)
	regexStaticImport = regexp.MustCompile(
		`(?m:^ *\bimport(?:[^;]|\n|\s)*?from ["'](.+?)["'])`,
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
		`\s(?m:^[^/*]*\b(?:` +
			strings.Join([]string{
				`jest\.\w+\(`,
				`test(:?\.each)?\(`,
				`(?:before|after)(?:Each|All)\(`,
				`expect(?:\.\w+)?\(`,
			}, "|") +
			`))`,
	)
	regexJestStyledComponents = regexp.MustCompile(`\.toHaveStyleRule\(`)
	regexProcessEnv           = regexp.MustCompile(`\bprocess\.env\b`)
	regexNodeTypes            = regexp.MustCompile(`\bNodeJS\..+`)
	regexKioskBrowser         = regexp.MustCompile(
		`\b(?:KioskBrowser\.|window\.kiosk)`,
	)
	regexReactTypes = regexp.MustCompile(`\bJSX\.`)
)

// Parse the passed file for import statements.
func ParseSourceFile(rootDir, filePath string) (ParseResult, []error) {
	extension := path.Ext(filePath)
	content, err := os.ReadFile(path.Join(rootDir, filePath))
	if err != nil {
		return ParseResult{}, []error{err}
	}

	stringContent := string(content)

	imports := map[string]bool{}

	for _, regexImportVariant := range []*regexp.Regexp{
		regexReexport,
		regexStaticImport,
		regexJestMock,
		regexSideEffectImport,
		regexDynamicImport,
		regexRequire,
	} {
		for _, match := range regexImportVariant.FindAllStringSubmatch(stringContent, -1) {
			moduleNameOrPath := match[1]
			if moduleNameOrPath == "" {
				continue
			}

			imports[moduleNameOrPath] = true

			//
			// Add @types imports for external packages:
			//

			if strings.HasPrefix(moduleNameOrPath, "@types/") ||
				strings.HasPrefix(moduleNameOrPath, "@vx/") ||
				strings.HasPrefix(moduleNameOrPath, ".") {
				continue
			}

			// TODO: Handle node imports without the `node:` prefix?
			if strings.HasPrefix(moduleNameOrPath, "node:") {
				imports["@types/node"] = true
				continue
			}

			moduleNameParts := strings.Split(moduleNameOrPath, "/")
			typesPackageName := moduleNameParts[0]
			if len(moduleNameParts) > 1 && moduleNameParts[0][0] == '@' {
				typesPackageName = strings.TrimPrefix(
					strings.Join(moduleNameParts, "__"),
					"@",
				)
			}
			imports["@types/"+typesPackageName] = true

			if moduleNameOrPath == "styled-components" {
				imports["@vx/libs/ui/styled-components"] = true
			}
		}
	}

	if regexJestReference.Match([]byte(stringContent)) {
		imports["@types/jest"] = true

		// Keeping detection simple for @testing-library/jest-dom for now and just
		// importing the types whenever we import `jest` types.
		imports["@types/testing-library__jest-dom"] = true
	}

	if regexJestStyledComponents.Match([]byte(stringContent)) {
		imports[ambientTypesImportJestStyledComponents] = true
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

	if regexReactTypes.Match([]byte(stringContent)) {
		imports["@types/react"] = true
	}

	if extension == ".tsx" {
		imports["@types/react"] = true
		imports["react"] = true
	}

	return ParseResult{
		Imports: imports,
		Modules: []string{},
	}, []error{}
}
