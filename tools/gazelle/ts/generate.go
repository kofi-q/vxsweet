package ts

import (
	"fmt"
	"io/fs"
	"log"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/bazelbuild/bazel-gazelle/language"
	"github.com/bazelbuild/bazel-gazelle/rule"
)

type JsImports struct {
	sourceImports map[ImportStatement]interface{}
	storyImports  map[ImportStatement]interface{}
	testImports   map[ImportStatement]interface{}
	typeImports   map[ImportStatement]interface{}
}

var (
	typeFileInfix  = ".d"
	testFileInfix  = ".test"
	storyFileInfix = ".stories"

	tsExtensions = []string{
		".ts",
		".tsx",
	}
)

type JsFiles struct {
	indexFiles  []string
	jsonFiles   []string
	sourceFiles []string
	testFiles   []string
	storyFiles  []string
	typeFiles   []string
}

// GenerateRules extracts build metadata from source files in a directory.
// GenerateRules is called in each directory where an update is requested
// in depth-first post-order.
//
// args contains the arguments for GenerateRules. This is passed as a
// struct to avoid breaking implementations in the future when new
// fields are added.
//
// A GenerateResult struct is returned. Optional fields may be added to this
// type in the future.
//
// Any non-fatal errors this function encounters should be logged using
// log.Print.
func (t *tsPackage) GenerateRules(
	args language.GenerateArgs,
) language.GenerateResult {
	// Ignore root package (for now):
	if args.Rel == "" {
		return newEmptyLanguageResult()
	}

	packageConfig, ok := args.Config.Exts[languageName].(*tsPackageConfig)
	if !ok {
		panic("unable to read ts_package configuration")
	}

	// Skip BUILD.bazel file creation for directories that aren't splittable yet:
	if packageConfig.isMonoPackageDescendant || packageConfig.isIgnoredPackage {
		return newEmptyLanguageResult()
	}

	result := language.GenerateResult{}
	sourceFiles := t.collectSourceFiles(args, packageConfig)

	// Add or edit/merge a rule for this source group.
	_, srcGenErr := t.addProjectRules(
		args,
		sourceFiles,
		&result,
	)
	if srcGenErr != nil {
		fmt.Fprintf(os.Stderr, "Source rule generation error: %v\n", srcGenErr)
		os.Exit(1)
	}

	return result
}

func (t *tsPackage) collectSourceFiles(
	args language.GenerateArgs,
	packageConfig *tsPackageConfig,
) *JsFiles {
	jsFiles := JsFiles{}

	processFile := func(filePathRel string) {
		fileExtension := path.Ext(filePathRel)
		if fileExtension == ".json" {
			jsFiles.jsonFiles = append(jsFiles.jsonFiles, filePathRel)
		}

		if !isTsExtension(fileExtension) {
			return
		}

		filenameWithoutSuffix := strings.TrimSuffix(
			filePathRel,
			path.Ext((filePathRel)),
		)

		if strings.HasSuffix(filenameWithoutSuffix, typeFileInfix) {
			jsFiles.typeFiles = append(jsFiles.typeFiles, filePathRel)
			return
		}

		if strings.HasSuffix(filenameWithoutSuffix, testFileInfix) {
			jsFiles.testFiles = append(jsFiles.testFiles, filePathRel)
			return
		}

		if strings.HasSuffix(filenameWithoutSuffix, storyFileInfix) {
			jsFiles.storyFiles = append(jsFiles.storyFiles, filePathRel)
			return
		}

		jsFiles.sourceFiles = append(jsFiles.sourceFiles, filePathRel)
	}

	if packageConfig.isMonoPackageRoot {
		err := filepath.WalkDir(
			args.Dir,
			func(filePathAbs string, d fs.DirEntry, err error) error {
				if d.IsDir() {
					return nil
				}

				relativePath, e := filepath.Rel(args.Dir, filePathAbs)
				if e != nil {
					log.Fatalf(
						"unable to construct workspace-relative path to %s: %+v\n",
						filePathAbs,
						e,
					)
				}

				processFile(relativePath)
				return nil
			},
		)
		if err != nil {
			log.Fatalf(
				"unable to collect source files in %s: %+v",
				args.Dir,
				err,
			)
			return nil
		}
	} else {
		for _, filename := range args.RegularFiles {
			processFile(filename)
		}
	}

	return &jsFiles
}

func (t *tsPackage) addProjectRules(
	args language.GenerateArgs,
	jsFiles *JsFiles,
	result *language.GenerateResult,
) ([]*rule.Rule, error) {
	rules := []*rule.Rule{}

	indexFileCount := len(jsFiles.indexFiles)
	jsonFileCount := len(jsFiles.jsonFiles)
	sourceFileCount := len(jsFiles.sourceFiles) +
		len(jsFiles.storyFiles) +
		len(jsFiles.testFiles) +
		len(jsFiles.typeFiles)

	if indexFileCount != 0 {
		indexRule := newTsLibraryRule()
		indexRule.SetName("index")
		indexRule.SetAttr("srcs", jsFiles.indexFiles)

		result.Gen = append(result.Gen, indexRule)
		result.Imports = append(
			result.Imports,
			t.findImports(args, &jsFiles.indexFiles),
		)

		rules = append(rules, indexRule)
	} else {
		result.Empty = append(result.Empty, newTsLibraryRule())
	}

	// HACK: Only include `:json` target if there are source files in the
	// directory (that may import it directly).
	if jsonFileCount != 0 && sourceFileCount != 0 {
		jsonRule := newJsonPackageRule()
		jsonRule.SetName("json")
		jsonRule.SetPrivateAttr("srcs", jsFiles.jsonFiles)

		result.Gen = append(result.Gen, jsonRule)
		result.Imports = append(
			result.Imports,
			map[ImportStatement]interface{}{},
		)

		rules = append(rules, jsonRule)
	} else {
		result.Empty = append(result.Empty, newJsonPackageRule())
	}

	if sourceFileCount == 0 {
		result.Empty = append(result.Empty, newTsPackageRule())
		return rules, nil
	}

	sourceRule := newTsPackageRule()
	sourceRule.SetName(path.Base(args.Dir))
	sourceRule.SetPrivateAttr("srcs", jsFiles)

	if len(jsFiles.indexFiles) != 0 {
		sourceRule.SetAttr("exclude", jsFiles.indexFiles)
	}

	imports := JsImports{}
	imports.sourceImports = t.findImports(args, &jsFiles.sourceFiles)
	imports.testImports = t.findImports(args, &jsFiles.testFiles)
	imports.storyImports = t.findImports(args, &jsFiles.storyFiles)
	imports.typeImports = t.findImports(args, &jsFiles.typeFiles)

	result.Gen = append(result.Gen, sourceRule)
	result.Imports = append(result.Imports, imports)

	rules = append(rules, sourceRule)

	return rules, nil
}

func (t *tsPackage) findImports(
	args language.GenerateArgs,
	files *[]string,
) map[ImportStatement]interface{} {
	imports := map[ImportStatement]interface{}{}

	for result := range t.parseFiles(args, files) {
		if len(result.Errors) > 0 {
			fmt.Printf("error parsing %s:\n", result.SourcePath)
			for _, err := range result.Errors {
				fmt.Printf("\t%s\n", err)
			}
		}

		for importStatement := range result.Imports {
			imports[importStatement] = nil
		}
	}

	return imports
}

func newTsPackageRule() *rule.Rule {
	packageRule := rule.NewRule(tsPackageKindName, "")
	packageRule.SetSortedAttrs([]string{
		"exclude",
		"src_deps",
		"story_deps",
		"test_deps",
		"type_deps",
		"visibility",
	})

	return packageRule
}

func newTsLibraryRule() *rule.Rule {
	libraryRule := rule.NewRule(tsLibraryKindName, "")
	libraryRule.SetSortedAttrs([]string{
		"srcs",
		"deps",
		"data",
		"tags",
		"visibility",
	})

	return libraryRule
}

func newJsonPackageRule() *rule.Rule {
	packageRule := rule.NewRule(jsonPackageKindName, "")
	packageRule.SetSortedAttrs([]string{
		"tags",
		"visibility",
	})

	return packageRule
}

func isTsExtension(fileExtension string) bool {
	for _, tsExtension := range tsExtensions {
		if tsExtension == fileExtension {
			return true
		}
	}

	return false
}

func newEmptyLanguageResult() language.GenerateResult {
	return language.GenerateResult{
		Empty: []*rule.Rule{

			newTsLibraryRule(),
			newTsPackageRule(),
		},
	}
}
