// Adapted from https://github.com/aspect-build/aspect-cli/tree/main/gazelle/js
// (Apache License Version 2.0)

package ts

import (
	"log"
	"math"
	"os"
	"path"
	"regexp"
	"strings"
	"sync"

	"github.com/bazelbuild/bazel-gazelle/config"
	"github.com/bazelbuild/bazel-gazelle/language"
	"github.com/bazelbuild/bazel-gazelle/resolve"
)

const (
	// The filename (with any of the TS extensions) imported when importing a directory.
	IndexFileName = "index"

	NpmPackageFilename = "package.json"

	DefaultRootTargetName = "root"

	MaxWorkerCount = 12
)

// ImportStatement represents an ImportSpec imported from a source file.
// Imports can be of any form (es6, cjs, amd, ...).
// Imports may be relative ot the source, absolute, workspace, named modules etc.
type ImportStatement struct {
	resolve.ImportSpec

	// The path of the file containing the import
	SourcePath string

	// The path as written in the import statement
	ImportPath string
}

type parseResult struct {
	SourcePath string
	Imports    map[ImportStatement]interface{}
	Modules    []string
	Errors     []error
}

func (t *tsPackage) parseFiles(
	args language.GenerateArgs,
	sourceFiles *[]string,
) chan parseResult {
	// The channel of all files to parse.
	sourcePathChannel := make(chan string)

	// The channel of parse results.
	resultsChannel := make(chan parseResult)

	// Limit number of workers:
	workerCount := int(math.Min(MaxWorkerCount, float64(1+len(*sourceFiles)/2)))

	// Kick off workers:
	var wg sync.WaitGroup
	for i := 0; i < workerCount; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()

			for sourcePath := range sourcePathChannel {
				resultsChannel <- t.collectImports(args.Config, sourcePath)
			}
		}()
	}

	// Send files to the workers.
	go func() {
		for _, sourceFile := range *sourceFiles {
			sourcePathChannel <- path.Join(args.Rel, sourceFile)
		}

		close(sourcePathChannel)
	}()

	// Wait for all workers to finish.
	go func() {
		wg.Wait()
		close(resultsChannel)
	}()

	return resultsChannel
}

func (t *tsPackage) collectImports(
	runConfig *config.Config,
	sourcePath string,
) parseResult {
	parseResults, errs := ParseSourceFile(runConfig.RepoRoot, sourcePath)

	result := parseResult{
		SourcePath: sourcePath,
		Errors:     errs,
		Imports:    map[ImportStatement]interface{}{},
		Modules:    parseResults.Modules,
	}

	for importPath := range parseResults.Imports {
		workspacePath := getWorkspacePath(runConfig, sourcePath, importPath)

		result.Imports[ImportStatement{
			ImportSpec: resolve.ImportSpec{
				Lang: languageName,
				Imp:  workspacePath,
			},
			ImportPath: importPath,
			SourcePath: sourcePath,
		}] = nil
	}

	return result
}

// Normalize the given import statement from a relative path
// to a path relative to the workspace.
func getWorkspacePath(
	runConfig *config.Config,
	sourceFilePath,
	importPath string,
) string {
	// Convert relative to workspace-relative
	if importPath[0] == '.' {
		importPath = path.Join(path.Dir(sourceFilePath), importPath)
	}

	packageConfig, ok := runConfig.Exts[languageName].(*tsPackageConfig)
	if !ok {
		panic("unable to read ts_package configuration")
	}

	for pattern, mappedPaths := range packageConfig.tsConfig.CompilerOptions.Paths {
		// e.g. "@vx/*" => /@vx\/(.+)/
		regexVxPath, err := regexp.Compile(
			strings.Replace(pattern, "*", "(.+)", 1),
		)
		if err != nil {
			log.Fatalf(
				"unable to generate @vx import path regex from tsconfig path %s\n",
				pattern,
			)
		}

		pathMatches := regexVxPath.FindStringSubmatch(importPath)
		if pathMatches == nil || len(pathMatches) < 2 {
			continue
		}

		for _, mappedPath := range mappedPaths {
			if !strings.Contains(mappedPath, "*") {
				log.Fatalf(
					"invalid tsconfig path value - missing '*': %s\n",
					mappedPath,
				)
			}

			potentialPath := strings.Replace(mappedPath, "*", pathMatches[1], 1)
			if !isValidImportPath(runConfig, potentialPath) {
				continue
			}

			return path.Clean(potentialPath)
		}
	}

	return path.Clean(importPath)
}

func isValidImportPath(
	runConfig *config.Config,
	importPath string,
) bool {
	for _, ext := range []string{"", ".ts", ".tsx"} {
		pathWithExtension := importPath + ext

		absolutePath := path.Join(runConfig.WorkDir, pathWithExtension)
		_, err := os.Stat(absolutePath)
		if err == nil {
			return true
		}

		if os.IsNotExist(err) {
			continue
		}

		log.Fatalf(
			"unable to validate potential import path %s: %+v",
			pathWithExtension,
			err,
		)
		return false
	}

	return false
}
