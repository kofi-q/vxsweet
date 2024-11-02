package parse

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

type MemorySrcLoader struct{ srcList []*Src }

func (self *MemorySrcLoader) LoadSrc(file *File) (*Src, error) {
	for _, src := range self.srcList {
		if src.file == file {
			return src, nil
		}
	}

	return nil, fmt.Errorf("file not found in memory loader: %s\n", file)
}

func assertExport(
	t *testing.T,
	repo *Repo,
	sourceFile *File,
	contents string,
	expected Exports,
) {
	src, err := ParseSrc(sourceFile, []byte(contents))
	require.NoError(t, err)
	defer src.Dispose()

	err = processModuleExports(
		src.file,
		repo,
		&MemorySrcLoader{srcList: []*Src{src}},
	)
	require.NoError(t, err)

	require.Equal(
		t,
		fmt.Sprint(expected),
		fmt.Sprint(src.file.exports),
	)
}

func TestExportDeclarations(t *testing.T) {
	repo := NewRepo()
	libsRandomStuff := repo.Add("libs/random/stuff.ts")

	assertExport(t, repo, libsRandomStuff,
		`
			type interface Nope {}
			export interface Foo {}
			export type Bar = {};

			const IGNORE_ME = true;
			export const DEFAULT_WIDTH;

			export function say(something: string): void {
				console.log(something);
			}
		`,
		Exports{{
			Flags:    EXPORT_NAMED | EXPORT_TYPE,
			Location: libsRandomStuff,
			Name:     "Foo",
		}, {
			Flags:    EXPORT_NAMED | EXPORT_TYPE,
			Location: libsRandomStuff,
			Name:     "Bar",
		}, {
			Flags:    EXPORT_NAMED,
			Location: libsRandomStuff,
			Name:     "DEFAULT_WIDTH",
		}, {
			Flags:    EXPORT_NAMED,
			Location: libsRandomStuff,
			Name:     "say",
		}},
	)
}

func TestExportDeclarationsDestructured(t *testing.T) {
	repo := NewRepo()
	libsRandomStuff := repo.Add("libs/random/stuff.ts")

	assertExport(t, repo, libsRandomStuff,
		`
			export const { ENV_VAR_1, ENV_VAR_2 } = process.env;

			const ELEMS = ["one", "two"] as const;
			export const [ARRAY_ELEM_1, ARRAY_ELEM_2] = ELEMS;
		`,
		Exports{{
			Flags:    EXPORT_NAMED,
			Location: libsRandomStuff,
			Name:     "ENV_VAR_1",
		}, {
			Flags:    EXPORT_NAMED,
			Location: libsRandomStuff,
			Name:     "ENV_VAR_2",
		}, {
			Flags:    EXPORT_NAMED,
			Location: libsRandomStuff,
			Name:     "ARRAY_ELEM_1",
		}, {
			Flags:    EXPORT_NAMED,
			Location: libsRandomStuff,
			Name:     "ARRAY_ELEM_2",
		}},
	)
}

func TestExportDefault(t *testing.T) {
	repo := NewRepo()
	libsRandomDo := repo.Add("libs/random/do.ts")
	libsRandomSay := repo.Add("libs/random/say.ts")

	t.Run("AtDeclaration", func(t *testing.T) {
		assertExport(t, repo, libsRandomSay,
			`
				export default function say(something: string): void {
					console.log(something);
				}
			`,
			Exports{{
				Flags:    EXPORT_DEFAULT,
				Location: libsRandomSay,
			}},
		)
	})

	t.Run("PreviouslyDeclared", func(t *testing.T) {
		assertExport(t, repo, libsRandomDo,
			`
				const do = (something: () => void)) => {
					something();
				}
				export default do;
			`,
			Exports{{
				Flags:    EXPORT_DEFAULT,
				Location: libsRandomDo,
			}},
		)
	})
}

func TestExportAsNamed(t *testing.T) {
	repo := NewRepo()
	libsRandomStuff := repo.Add("libs/random/stuff.ts")

	assertExport(t, repo, libsRandomStuff,
		`
			interface Fluff {}
			interface Filler {}
		  type HotAir = string | Fluff | Filler;

			const foo: HotAir = "bar";
			const bat: HotAir = "man";

			export { foo, bat as baz, type HotAir };
			export type { Fluff, Filler as Fuzz };
		`,
		Exports{
			{
				Flags:    EXPORT_NAMED,
				Location: libsRandomStuff,
				Name:     "foo",
			},
			{
				Flags:        EXPORT_NAMED | EXPORT_ALIAS,
				Location:     libsRandomStuff,
				Name:         "baz",
				OriginalName: "bat",
			},
			{
				Flags:    EXPORT_NAMED | EXPORT_TYPE,
				Location: libsRandomStuff,
				Name:     "HotAir",
			},
			{
				Flags:    EXPORT_NAMED | EXPORT_TYPE,
				Location: libsRandomStuff,
				Name:     "Fluff",
			},
			{
				Flags:        EXPORT_NAMED | EXPORT_TYPE | EXPORT_ALIAS,
				Location:     libsRandomStuff,
				OriginalName: "Filler",
				Name:         "Fuzz",
			},
		},
	)
}

func TestReexportAsWildcard(t *testing.T) {
	repo := NewRepo()
	libsUiBasicsIndex := repo.Add("libs/ui/basics/index.ts")
	libsUiBasicsButton := repo.Add("libs/ui/basics/button.ts")

	assertExport(t, repo, libsUiBasicsIndex,
		`export * from './button';`,
		Exports{{
			Flags:    EXPORT_WILDCARD,
			From:     libsUiBasicsButton,
			Location: libsUiBasicsIndex,
		}},
	)
}

func TestReexportAsNamespace(t *testing.T) {
	repo := NewRepo()
	libsUiBasicsIndex := repo.Add("libs/ui/basics/index.ts")
	libsUiBasicsButton := repo.Add("libs/ui/basics/button.ts")

	assertExport(t, repo, libsUiBasicsIndex,
		`export * as button from './button';`,
		Exports{{
			Flags:    EXPORT_NAMESPACE,
			Location: libsUiBasicsIndex,
			Name:     "button",
			From:     libsUiBasicsButton,
		}},
	)
}

func TestReexportAsNamed(t *testing.T) {
	repo := NewRepo()
	libsUiBasicsIndex := repo.Add("libs/ui/basics/index.ts")
	libsUiBasicsButton := repo.Add("libs/ui/basics/button.ts")

	assertExport(t, repo, libsUiBasicsIndex,
		`export { Button, type ButtonProps } from './button';`,
		Exports{{
			Flags:    EXPORT_NAMED,
			From:     libsUiBasicsButton,
			Location: libsUiBasicsIndex,
			Name:     "Button",
		}, {
			Flags:    EXPORT_NAMED | EXPORT_TYPE,
			From:     libsUiBasicsButton,
			Location: libsUiBasicsIndex,
			Name:     "ButtonProps",
		}},
	)
}

func TestReexportAsAlias(t *testing.T) {
	repo := NewRepo()
	libsUiBasicsIndex := repo.Add("libs/ui/basics/index.ts")
	libsUiBasicsButton := repo.Add("libs/ui/basics/button.ts")

	assertExport(t, repo, libsUiBasicsIndex,
		`export { Button, type ButtonProps as Props } from './button';`,
		Exports{{
			Flags:    EXPORT_NAMED,
			From:     libsUiBasicsButton,
			Location: libsUiBasicsIndex,
			Name:     "Button",
		}, {
			Flags:        EXPORT_NAMED | EXPORT_TYPE | EXPORT_ALIAS,
			From:         libsUiBasicsButton,
			Location:     libsUiBasicsIndex,
			Name:         "Props",
			OriginalName: "ButtonProps",
		}},
	)
}

func TestReexportTypeGroup(t *testing.T) {
	repo := NewRepo()
	libsUiBasicsIndex := repo.Add("libs/ui/basics/index.ts")
	libsUiBasicsButton := repo.Add("libs/ui/basics/button.ts")

	assertExport(t, repo, libsUiBasicsIndex,
		`export type { ButtonProps, ButtonVariant } from './button';`,
		Exports{{
			Flags:    EXPORT_NAMED | EXPORT_TYPE,
			From:     libsUiBasicsButton,
			Location: libsUiBasicsIndex,
			Name:     "ButtonProps",
		}, {
			Flags:    EXPORT_NAMED | EXPORT_TYPE,
			From:     libsUiBasicsButton,
			Location: libsUiBasicsIndex,
			Name:     "ButtonVariant",
		}},
	)
}
