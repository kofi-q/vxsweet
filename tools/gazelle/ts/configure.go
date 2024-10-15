package ts

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path"

	"github.com/bazelbuild/bazel-gazelle/config"
	"github.com/bazelbuild/bazel-gazelle/rule"
)

var (
	directiveIgnorePackage = "js_ignore"
	directiveMonoPackage   = "js_mono_package"
)

type tsPackageConfig struct {
	// Indicates whether the current directory exists in the subdirectory tree of
	// a mono-package root
	//
	// See [tsPackageConfig.isMonoPackageRoot].
	isMonoPackageDescendant bool

	// Indicates whether the current directory marks the root of an unconverted
	// mono-package, where all files in the subdirectory tree  are recursively
	// rolled up into a top-level project.
	isMonoPackageRoot bool

	// Indicates whether the current directory or one of its ancestors has been
	// marked with the `gazelle:js_ignore` directive and shouldn't be a part of
	// the build.
	isIgnoredPackage bool

	// See [PackageJson]
	packageJson *PackageJson

	tsConfig *TsConfig
}

func (self tsPackageConfig) createChild() *tsPackageConfig {
	return &tsPackageConfig{
		isIgnoredPackage: self.isIgnoredPackage,
		isMonoPackageDescendant: self.isMonoPackageDescendant ||
			self.isMonoPackageRoot,
		packageJson: self.packageJson,
		tsConfig:    self.tsConfig,
	}
}

// Contains workspace path mapping information from the root tsconfi.json file.
type TsConfig struct {
	CompilerOptions TsConfigCompilerOptions
}

type TsConfigCompilerOptions struct {
	Paths map[string][]string
}

// Contains NPM dependency data from the root package.json file.
type PackageJson struct {
	Dependencies    NpmDependencies
	DevDependencies NpmDependencies
}

type NpmDependencies = map[string]string

// Configure implements language.Language.
func (t *tsPackage) Configure(
	runConfig *config.Config,
	cwdRelativePath string,
	buildFile *rule.File,
) {
	if cwdRelativePath == "" {
		tsConfig := make(chan *TsConfig)
		go getTsConfig(runConfig, cwdRelativePath, tsConfig)

		packageJson := make(chan *PackageJson)
		go getPackageJson(runConfig, cwdRelativePath, packageJson)

		runConfig.Exts[languageName] = &tsPackageConfig{
			packageJson: <-packageJson,
			tsConfig:    <-tsConfig,
		}

		return
	}

	parentConfig, ok := runConfig.Exts[languageName].(*tsPackageConfig)
	if !ok {
		panic("unable to read ts_package configuration")
	}

	packageConfig := parentConfig.createChild()
	runConfig.Exts[languageName] = packageConfig

	if buildFile == nil {
		return
	}

	for _, directive := range buildFile.Directives {
		switch directive.Key {
		case directiveMonoPackage:
			packageConfig.isMonoPackageRoot = true
		case directiveIgnorePackage:
			packageConfig.isIgnoredPackage = true
		}
	}
}

func getTsConfig(
	runConfig *config.Config,
	cwdRelativePath string,
	outputChannel chan *TsConfig,
) {
	tsConfigFileData, err := os.ReadFile(
		path.Join(runConfig.WorkDir, cwdRelativePath, "tsconfig.json"),
	)
	if err != nil {
		fmt.Printf("unable to open tsconfig.json: %v\n", err)
		os.Exit(1)
		return
	}

	tsConfig := TsConfig{}
	err = json.Unmarshal(tsConfigFileData, &tsConfig)
	if err != nil {
		fmt.Printf("unable to parse tsconfig.json: %v\n", err)
		os.Exit(1)
		return
	}

	outputChannel <- &tsConfig
}

func getPackageJson(
	runConfig *config.Config,
	cwdRelativePath string,
	outputChannel chan *PackageJson,
) {
	fileData, err := os.ReadFile(
		path.Join(runConfig.WorkDir, cwdRelativePath, "package.json"),
	)
	if err != nil {
		fmt.Printf("unable to open package.json file: %v\n", err)
		os.Exit(1)
		return
	}

	packageJson := PackageJson{}
	err = json.Unmarshal(fileData, &packageJson)
	if err != nil {
		fmt.Printf("unable to parse package.json file: %v\n", err)
		os.Exit(1)
		return
	}

	outputChannel <- &packageJson
}

// CheckFlags validates the configuration after command line flags are parsed.
// This is called once with the root configuration when Gazelle starts.
// CheckFlags may set default values in flags or make implied changes.
func (t *tsPackage) CheckFlags(fs *flag.FlagSet, c *config.Config) error {
	return nil
}

// KnownDirectives returns a list of directive keys that this Configurer can
// interpret. Gazelle prints errors for directives that are not recoginized by
// any Configurer.
func (t *tsPackage) KnownDirectives() []string {
	return []string{
		directiveIgnorePackage,
		directiveMonoPackage,
		"prefix", // Just to silence the "unknown directive" warning for "gazelle:prefix"
	}
}

// RegisterFlags registers command-line flags used by the extension. This
// method is called once with the root configuration when Gazelle
// starts. RegisterFlags may set an initial values in Config.Exts. When flags
// are set, they should modify these values.
func (t *tsPackage) RegisterFlags(
	fs *flag.FlagSet,
	cmd string,
	c *config.Config,
) {}
