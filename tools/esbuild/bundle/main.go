package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"path"
	"regexp"
	"slices"

	esbuild "github.com/evanw/esbuild/pkg/api"
	dotenv "github.com/joho/godotenv"
)

var (
	pathEntryPoint = flag.String(
		"entryPoint",
		"",
		"Path to the entry point source file, relative to PWD "+
			"(or the exec root, if running under Bazel).",
	)
	pathIndexHtml = flag.String(
		"indexHtml",
		"",
		"Path to index.html, relative to PWD "+
			"(or the exec root, if running under Bazel).",
	)
	pathOutHtml = flag.String(
		"outHtml",
		"",
		"Output path for index.html, relative to PWD "+
			"(or the exec root, if running under Bazel).",
	)
	pathOutJs = flag.String(
		"outJsBundle",
		"",
		"Output path for the static JS bundle, relative to `pathRootDir`,",
	)
	pathPackageRoot = flag.String(
		"packageRootDir",
		"",
		"Repo-relative path to the root of the app package.",
	)
	pathRootDir = flag.String(
		"rootDir",
		"",
		"Root directory for resolving imports, relative to PWD "+
			"(or the exec root, if running under Bazel).",
	)
	urlJsBundle = flag.String(
		"urlJsBundle",
		"",
		"URL path from which the JS bundle will be served.",
	)
)

var (
	// [TODO] Make this less brittle.
	regexBundleScriptTag = regexp.MustCompile(`<script .+ src=".+?">`)
)

func main() {
	flag.Parse()
	if slices.Contains(
		[]string{
			*pathEntryPoint,
			*pathIndexHtml,
			*pathOutHtml,
			*pathOutJs,
			*pathPackageRoot,
			*pathRootDir,
			*urlJsBundle,
		},
		"",
	) {
		flag.Usage()
		os.Exit(1)
	}

	pwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintln(os.Stderr, "Unable to get working directory:", err)
		os.Exit(1)
	}

	envVars := loadDotEnvVars(pwd)
	envVars["process.env.NODE_DEBUG"] = `undefined`
	envVars["process.env.NODE_ENV"] = `"production"`
	envVars["process.platform"] = `"browser"`

	result := esbuild.Build(esbuild.BuildOptions{
		AbsWorkingDir: path.Join(pwd, *pathRootDir),
		Alias: map[string]string{
			"glob":        "./libs/browser-stubs/glob",
			"node:assert": "assert",
			"node:buffer": "buffer",
			"node:events": "events",
			"node:fs":     "./libs/browser-stubs/fs",
			"node:os":     "./libs/browser-stubs/os",
			"node:path":   "path",
			"node:stream": "stream-browserify",
			"node:util":   "util",
			"node:zlib":   "browserify-zlib",
			"pagedjs":     "pagedjs/dist/paged.esm",
		},
		Bundle:      true,
		Color:       esbuild.ColorAlways,
		Define:      envVars,
		EntryPoints: []string{*pathEntryPoint},
		Format:      esbuild.FormatESModule,
		LogLevel:    esbuild.LogLevelWarning,
		Outbase:     ".",
		Outfile:     *pathOutJs,
		Target:      esbuild.ESNext,
		TreeShaking: esbuild.TreeShakingTrue,
		Write:       true,
	})

	if len(result.Errors) > 0 {
		os.Exit(1)
	}

	writeIndexHtml()
}

func writeIndexHtml() {
	contents, err := os.ReadFile(*pathIndexHtml)
	if err != nil {
		log.Fatalln("[ERROR] Unable to read index.html", err)
	}

	scriptTag := fmt.Sprintf(
		`<script type="module" crossorigin src="%s">`,
		*urlJsBundle,
	)
	contents = regexBundleScriptTag.ReplaceAll(contents, []byte(scriptTag))

	err = os.WriteFile(*pathOutHtml, contents, 0o666)
	if err != nil {
		log.Fatalln("[ERROR] Unable to write index.html asset", *pathOutHtml, err)
	}
}

func loadDotEnvVars(pwd string) map[string]string {
	repoRoot := path.Join(pwd, *pathRootDir)
	appDir := path.Join(repoRoot, *pathPackageRoot)

	dotenvFiles := []string{}
	for _, dotenvFile := range []string{
		path.Join(appDir, ".env.production"),
		path.Join(appDir, ".env"),
		path.Join(repoRoot, ".env.production"),
		path.Join(repoRoot, ".env"),
	} {
		if _, err := os.Stat(dotenvFile); err == nil {
			dotenvFiles = append(dotenvFiles, dotenvFile)
		}
	}

	envVars, err := dotenv.Read(dotenvFiles...)
	if err != nil {
		log.Fatalln("[ERROR] Unable to read .env files", err)
	}

	processEnvVars := map[string]string{}
	for key := range envVars {
		processEnvVars["process.env."+key] = fmt.Sprintf(`"%s"`, envVars[key])
	}

	return processEnvVars
}
