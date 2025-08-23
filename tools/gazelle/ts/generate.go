package ts

import (
	"fmt"
	"io/fs"
	"log"
	"os"
	"path"
	"path/filepath"
	"slices"
	"strings"

	"github.com/bazelbuild/bazel-gazelle/language"
	"github.com/bazelbuild/bazel-gazelle/rule"
)

type JsImports map[ImportStatement]any

var (
	testFileInfix  = ".test"
	storyFileInfix = ".stories"

	tsExtensions = []string{
		".ts",
		".tsx",
	}
)

type JsFiles struct {
	jsonFiles   []string
	sourceFiles []string
	storyFiles  []string
	testFiles   []string
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
	srcGenErr := t.addPackageRules(
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
			return
		}

		if !isTsExtension(fileExtension) {
			return
		}

		filenameWithoutSuffix := strings.TrimSuffix(
			filePathRel,
			path.Ext((filePathRel)),
		)

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

func (t *tsPackage) addPackageRules(
	args language.GenerateArgs,
	jsFiles *JsFiles,
	result *language.GenerateResult,
) error {
	if err := t.addLibraryRule(args, jsFiles, result); err != nil {
		return err
	}

	if err := t.addTestsRule(args, jsFiles, result); err != nil {
		return err
	}

	if err := t.addLintRule(jsFiles, result); err != nil {
		return err
	}

	if err := t.addStoriesRule(args, jsFiles, result); err != nil {
		return err
	}

	if err := t.addJsonRule(jsFiles, result); err != nil {
		return err
	}

	return nil
}

func (t *tsPackage) addLibraryRule(
	args language.GenerateArgs,
	jsFiles *JsFiles,
	result *language.GenerateResult,
) error {
	if len(jsFiles.sourceFiles) == 0 {
		result.Empty = append(result.Empty, newTsLibraryRule())
		return nil
	}

	sourceRule := newTsLibraryRule()
	sourceRule.SetName(path.Base(args.Dir))
	sourceRule.SetPrivateAttr("srcs", jsFiles.sourceFiles)

	result.Gen = append(result.Gen, sourceRule)
	result.Imports = append(
		result.Imports,
		t.findImports(args, &jsFiles.sourceFiles),
	)

	return nil
}

func (t *tsPackage) addTestsRule(
	args language.GenerateArgs,
	jsFiles *JsFiles,
	result *language.GenerateResult,
) error {
	if len(jsFiles.testFiles) == 0 {
		result.Empty = append(result.Empty, newTsTestsRule())
		return nil
	}

	testsRule := newTsTestsRule()
	testsRule.SetName("tests")
	testsRule.SetPrivateAttr("srcs", jsFiles.testFiles)

	result.Gen = append(result.Gen, testsRule)
	result.Imports = append(
		result.Imports,
		t.findImports(args, &jsFiles.testFiles),
	)

	return nil
}

func (t *tsPackage) addLintRule(
	jsFiles *JsFiles,
	result *language.GenerateResult,
) error {
	if len(
		jsFiles.sourceFiles,
	)+len(
		jsFiles.testFiles,
	)+len(
		jsFiles.storyFiles,
	) == 0 {
		result.Empty = append(result.Empty, newLintTestRule())
		return nil
	}

	lintRule := newLintTestRule()
	lintRule.SetName("lint")

	result.Gen = append(result.Gen, lintRule)
	result.Imports = append(result.Imports, JsImports{})

	return nil
}

func (t *tsPackage) addStoriesRule(
	args language.GenerateArgs,
	jsFiles *JsFiles,
	result *language.GenerateResult,
) error {
	if len(jsFiles.storyFiles) == 0 {
		result.Empty = append(result.Empty, newTsStoriesRule())
		return nil
	}

	storiesRule := newTsStoriesRule()
	storiesRule.SetName("stories")
	storiesRule.SetPrivateAttr("srcs", jsFiles.storyFiles)

	result.Gen = append(result.Gen, storiesRule)
	result.Imports = append(
		result.Imports,
		t.findImports(args, &jsFiles.storyFiles),
	)

	return nil
}

func (t *tsPackage) addJsonRule(
	jsFiles *JsFiles,
	result *language.GenerateResult,
) error {
	if len(jsFiles.jsonFiles) == 0 ||
		// HACK: Only include `:json` target if there are source files in the
		// directory (that may import it directly).
		len(jsFiles.sourceFiles)+
			len(jsFiles.testFiles)+
			len(jsFiles.storyFiles) == 0 {
		result.Empty = append(result.Empty, newJsonPackageRule())
		return nil
	}

	jsonRule := newJsonPackageRule()
	jsonRule.SetName("json")
	jsonRule.SetPrivateAttr("srcs", jsFiles.jsonFiles)

	result.Gen = append(result.Gen, jsonRule)
	result.Imports = append(result.Imports, JsImports{})

	return nil
}

func (t *tsPackage) findImports(
	args language.GenerateArgs,
	files *[]string,
) JsImports {
	imports := JsImports{}

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

func newTsTestsRule() *rule.Rule {
	testsRule := rule.NewRule(tsTestsKindName, "")
	testsRule.SetSortedAttrs([]string{
		"srcs",
		"deps",
		"data",
		"tags",
		"visibility",
	})

	return testsRule
}

func newLintTestRule() *rule.Rule {
	testsRule := rule.NewRule(lintTestKindName, "")
	testsRule.SetSortedAttrs([]string{
		"srcs",
		"data",
		"tags",
		"visibility",
	})

	return testsRule
}

func newTsStoriesRule() *rule.Rule {
	storiesRule := rule.NewRule(tsStoriesKindName, "")
	storiesRule.SetSortedAttrs([]string{
		"srcs",
		"deps",
		"data",
		"tags",
		"visibility",
	})

	return storiesRule
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
	return slices.Contains(tsExtensions, fileExtension)
}

func newEmptyLanguageResult() language.GenerateResult {
	return language.GenerateResult{
		Empty: []*rule.Rule{
			newJsonPackageRule(),
			newTsLibraryRule(),
			newTsStoriesRule(),
			newTsTestsRule(),
			newLintTestRule(),
		},
	}
}
