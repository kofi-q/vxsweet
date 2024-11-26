package main

import (
	"bytes"
	"flag"
	"fmt"
	"log"
	"os"
	"regexp"
	"strings"

	esbuild "github.com/evanw/esbuild/pkg/api"
)

const SHOULD_HOIST_JEST_MOCKS = true

var (
	pathOutDir = flag.String(
		"outDir",
		"",
		"Output file path, relative to PWD "+
			"(or the exec root, if running under Bazel).",
	)

	regexJestMock = regexp.MustCompile(
		`(?m:` +
			strings.Join([]string{
				`^jest\.mock\(.+?\);\n`,
				`^jest\.mock\((?:.|\n)*?\n[})]*\);\n`,
			}, "|") +
			`)`,
	)
)

func main() {
	flag.Parse()
	if *pathOutDir == "" {
		flag.Usage()
		os.Exit(1)
	}

	pwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintln(os.Stderr, "Unable to get working directory:", err)
		os.Exit(1)
	}

	result := esbuild.Build(esbuild.BuildOptions{
		AbsWorkingDir: pwd,
		Bundle:        false,
		Color:         esbuild.ColorAlways,
		Define: map[string]string{
			"process.env.NODE_ENV": "process.env.NODE_ENV",
		},
		EntryPoints:    flag.Args(),
		Format:         esbuild.FormatCommonJS,
		JSX:            esbuild.JSXTransform,
		LogLevel:       esbuild.LogLevelWarning,
		Outdir:         *pathOutDir,
		Outbase:        ".",
		Sourcemap:      esbuild.SourceMapInline,
		SourcesContent: esbuild.SourcesContentExclude,
		Target:         esbuild.ESNext,
		Write:          !SHOULD_HOIST_JEST_MOCKS,
	})

	if len(result.Errors) > 0 {
		os.Exit(1)
	}

	if !SHOULD_HOIST_JEST_MOCKS {
		os.Exit(0)
	}

	for _, outputFile := range result.OutputFiles {
		updatedOutput := maybeHoistJestMocks(&outputFile)

		err := os.WriteFile(updatedOutput.Path, updatedOutput.Contents, 0o666)
		if err != nil {
			log.Fatalln(
				"[ERROR] Unable to write output file",
				updatedOutput.Path,
				err,
			)
		}
	}
}

// [esbuild] follows the ESM convention of hoisting imports to the top of the
// file, whereas Jest relies on transformations that hoist jest mock
// declarations to the top. This satisfies the latter at build time, to avoid
// having to do it on every test run, even if it's fairly cheap for a single
// file.
//
// [TODO] Try building to ESM and avoid this, if Jest support for ESM isn't
// too lacking.
func maybeHoistJestMocks(outputFile *esbuild.OutputFile) *esbuild.OutputFile {
	if !strings.HasSuffix(outputFile.Path, ".test.js") {
		return outputFile
	}

	yankedStatements := [][]byte{}
	updatedCode := regexJestMock.ReplaceAllFunc(
		outputFile.Contents,
		func(match []byte) []byte {
			yankedStatements = append(yankedStatements, match)
			return []byte{}
		},
	)

	if len(yankedStatements) == 0 {
		return outputFile
	}

	idxLineAfterStrictModeStatement := bytes.IndexAny(updatedCode, "\n") + 1
	newHeader := append(
		[]byte{},
		updatedCode[:idxLineAfterStrictModeStatement]...)
	newHeader = append(newHeader, bytes.Join(yankedStatements, nil)...)

	// [TODO] Update the inline sourcemap? Don't expect too many stack traces
	// referencing the mocks/imports section, compared to in-code traces.
	outputFile.Contents = append(
		newHeader,
		updatedCode[idxLineAfterStrictModeStatement:]...,
	)

	return outputFile
}
