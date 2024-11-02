package main

import (
	"strings"
	"testing"

	"github.com/kofi-q/vxsweet/tools/ts-refactor/parse"
	"github.com/stretchr/testify/require"
)

type refactorSpec struct {
	contents string
	expected string
	repo     *parse.Repo
	importer *parse.File
}

func assertRefactor(t *testing.T, spec refactorSpec) {
	src, err := parse.ParseSrc(spec.importer, []byte(spec.contents))
	require.NoError(t, err)
	defer src.Dispose()

	result, err := newRefactorTask(src, spec.repo).run()

	require.NoError(t, err)
	require.Equal(
		t,
		strings.TrimSpace(spec.expected),
		strings.TrimSpace(result),
	)
}

func TestRefactorSimpleNamedImports(t *testing.T) {
	repo := buildTestRepo()

	assertRefactor(t, refactorSpec{
		contents: `
import Buffer from 'node:buffer';
import { Button, ButtonProps, QrCode } from '@vx/libs/ui/src';
import { Select } from '@vx/libs/ui/controls/select';

export function foo(): string {
	return 'bar';
}
		`,
		expected: `
import Buffer from 'node:buffer';
import { Button, type ButtonProps, Select } from '@vx/libs/ui/basic';
import { QrCode } from '@vx/libs/ui/ballots';

export function foo(): string {
	return 'bar';
}
		`,
		importer: repo.Add("apps/mark/frontend/src/foo.ts"),
		repo:     repo,
	})
}

func TestRefactorAliasImport(t *testing.T) {
	repo := buildTestRepo()
	assertRefactor(t, refactorSpec{
		contents: `import { Button as Btn } from '@vx/libs/ui/src/button';`,
		expected: `import { Button as Btn } from '@vx/libs/ui/basic';`,
		importer: repo.Add("apps/admin/frontend/app.tsx"),
		repo:     repo,
	})
}

func TestRefactorDefaultImport(t *testing.T) {
	repo := buildTestRepo()
	assertRefactor(t, refactorSpec{
		contents: `import styled, { css } from '@vx/libs/styled-components/styled';`,
		expected: `import styled, { css } from '@vx/libs/styled-components/styled';`,
		importer: repo.Add("apps/admin/frontend/app.tsx"),
		repo:     repo,
	})
}

func TestRefactorSameDirectoryImport(t *testing.T) {
	repo := buildTestRepo()
	assertRefactor(t, refactorSpec{
		contents: `import { Button, ButtonProps } from '@vx/libs/ui/src';`,
		expected: `import { Button, type ButtonProps } from './button';`,
		importer: repo.Add("libs/ui/basic/link_button.ts"),
		repo:     repo,
	})
}

func TestRefactorNamespacedReexport(t *testing.T) {
	repo := buildTestRepo()
	assertRefactor(t, refactorSpec{
		contents: `import { Typography } from '@vx/libs/ui/src';`,
		expected: `import { Typography } from '@vx/libs/ui/src';`,
		importer: repo.Add("apps/mark/frontend/src/foo.ts"),
		repo:     repo,
	})
}

func TestRefactorWildcardImports(t *testing.T) {
	repo := buildTestRepo()
	assertRefactor(t, refactorSpec{
		contents: `import * as grout from '@vx/libs/grout/src';`,
		expected: `import * as grout from '@vx/libs/grout';`,
		importer: repo.Add("apps/mark/frontend/src/foo.ts"),
		repo:     repo,
	})
}

func TestRefactorCommonPackageImport(t *testing.T) {
	repo := buildTestRepo()
	assertRefactor(t, refactorSpec{
		contents: `import * as uiBasics from '@vx/libs/ui/basic';`,
		expected: `import * as uiBasics from '../basic';`,
		importer: repo.Add("libs/ui/test/some_util.ts"),
		repo:     repo,
	})
}

func TestRefactorDotPackageImport(t *testing.T) {
	t.Run("WithNoFileMoves", func(t *testing.T) {
		repo := buildTestRepo()
		assertRefactor(t, refactorSpec{
			contents: `import * as grout from '.';`,
			expected: `import * as grout from '.';`,
			importer: repo.Add("libs/grout/index.test.ts"),
			repo:     repo,
		})
	})

	t.Run("WithMovedIndexFile", func(t *testing.T) {
		repo := buildTestRepo()
		assertRefactor(t, refactorSpec{
			contents: `import * as grout from '.';`,
			expected: `import * as grout from '..';`,
			importer: repo.Add("libs/grout/src/left_behind.test.ts"),
			repo:     repo,
		})
	})
}

func TestRefactorSideEffectImport(t *testing.T) {
	t.Run("WithNoFileMoves", func(t *testing.T) {
		repo := buildTestRepo()
		assertRefactor(t, refactorSpec{
			contents: `import './side_effect';`,
			expected: `import './side_effect';`,
			importer: repo.Add("libs/ui/basic/uses_side_effect.ts"),
			repo:     repo,
		})
	})

	t.Run("WithMovedIndexFile", func(t *testing.T) {
		repo := buildTestRepo()
		assertRefactor(t, refactorSpec{
			contents: `import './side_effect';`,
			expected: `import '../../basic/side_effect';`,
			importer: repo.Add("libs/ui/src/basic/uses_side_effect.ts"),
			repo:     repo,
		})
	})
}

func TestRefactorPreserveTypeImport(t *testing.T) {
	t.Run("WithNameLevelTag", func(t *testing.T) {
		repo := buildTestRepo()
		assertRefactor(t, refactorSpec{
			contents: `import { type Button } from '@vx/libs/ui/basic';`,
			expected: `import { type Button } from '@vx/libs/ui/basic';`,
			importer: repo.Add("apps/mark/frontend/app.ts"),
			repo:     repo,
		})
	})

	// TODO: Should preserve import-level tags:
	t.Run("WithImportLevelTag", func(t *testing.T) {
		repo := buildTestRepo()
		assertRefactor(t, refactorSpec{
			contents: `import type { Button } from '@vx/libs/ui/basic';`,
			expected: `import { type Button } from '@vx/libs/ui/basic';`,
			importer: repo.Add("apps/mark/frontend/app.ts"),
			repo:     repo,
		})
	})
}

func TestRefactorImportingFileMoved(t *testing.T) {
	repo := buildTestRepo()
	assertRefactor(t, refactorSpec{
		contents: `import { QrCode } from './ballots/qrcode';`,
		expected: `import { QrCode } from '../ballots/qrcode';`,
		importer: repo.Find("libs/ui/src/button.ts"),
		repo:     repo,
	})
}

func TestRefactorJestAutoMock(t *testing.T) {
	repo := buildTestRepo()
	assertRefactor(t, refactorSpec{
		contents: `
jest.mock('styled-components');
jest.mock('@vx/libs/ui/src');
jest.mock('@vx/libs/ui/src');
import { Button } from '@vx/libs/ui/basic';
		`,
		expected: `
jest.mock('styled-components');
jest.mock('@vx/libs/ui/ballots');
jest.mock('@vx/libs/ui/basic');
import { Button } from '@vx/libs/ui/basic';
		`,
		importer: repo.Add("apps/scan/frontend/foo.test.ts"),
		repo:     repo,
	})
}

func TestRefactorJestMockRelative(t *testing.T) {
	repo := buildTestRepo()
	assertRefactor(t, refactorSpec{
		contents: `jest.mock('./button');`,
		expected: `jest.mock('./button');`,
		importer: repo.Add("libs/ui/basic/foo.test.ts"),
		repo:     repo,
	})
}

func TestRefactorJestManualMock(t *testing.T) {
	repo := buildTestRepo()
	importer := repo.Add("apps/scan/frontend/foo.test.tsx")

	t.Run("WithSimpleObject", func(t *testing.T) {
		assertRefactor(t, refactorSpec{
			contents: `
jest.mock('styled-components');
jest.mock('@vx/libs/ui/src', () => ({
  // foo bar
  ...jest.requireActual('@vx/libs/ui/src'),
  Button: jest.fn(),
}));
jest.mock('@vx/libs/ui/controls/select', () => ({
  // blip blam
  ...jest.requireActual('@vx/libs/ui/controls/select'),
  Select: jest.fn(),
}));

import { Button } from '@vx/libs/ui/basic';
			`,
			expected: `
jest.mock('styled-components');
jest.mock('@vx/libs/ui/basic', () => ({
  // foo bar
  ...jest.requireActual('@vx/libs/ui/basic'),
  Button: jest.fn(),
  // blip blam
  Select: jest.fn(),
}));

import { Button } from '@vx/libs/ui/basic';
			`,
			importer: importer,
			repo:     repo,
		})
	})

	t.Run("WithFunctionBlock", func(t *testing.T) {
		assertRefactor(t, refactorSpec{
			contents: `
jest.mock('styled-components');
jest.mock('@vx/libs/ui/src', (): typeof import('@vx/libs/ui/src') => {
  // This is a comment.
  // So is this.
  const actual = jest.requireActual('@vx/libs/ui/src');

  return {
	  ...actual,
	  Button: jest.fn(),
    QrCode() {
      return <div>code</div>
    },
	};
});

import { Button } from '@vx/libs/ui/basic';
			`,
			expected: `
jest.mock('styled-components');
jest.mock('@vx/libs/ui/basic', (): typeof import('@vx/libs/ui/basic') => {
  // This is a comment.
  // So is this.
  const actual = jest.requireActual('@vx/libs/ui/basic');

  return {
    ...actual,
    Button: jest.fn(),
  };
});
jest.mock('@vx/libs/ui/ballots', (): typeof import('@vx/libs/ui/ballots') => {
  // This is a comment.
  // So is this.
  const actual = jest.requireActual('@vx/libs/ui/ballots');

  return {
    ...actual,
    QrCode() {
      return <div>code</div>
    },
  };
});

import { Button } from '@vx/libs/ui/basic';
			`,
			importer: importer,
			repo:     repo,
		})
	})
}

func TestRefactorSimpleNamedExports(t *testing.T) {
	repo := buildTestRepo()

	assertRefactor(t, refactorSpec{
		contents: `
export { Button, ButtonProps } from './button';
export { QrCode } from './ballots/qrcode';
		`,
		expected: `
export { Button, type ButtonProps } from '../basic/button';
export { QrCode } from '../ballots/qrcode';
		`,
		importer: repo.Find("libs/ui/src/index.ts"),
		repo:     repo,
	})
}

func TestRefactorAliasExport(t *testing.T) {
	repo := buildTestRepo()
	assertRefactor(t, refactorSpec{
		contents: `export { Button as Btn } from './button';`,
		expected: `export { Button as Btn } from '../basic/button';`,
		importer: repo.Find("libs/ui/src/index.ts"),
		repo:     repo,
	})
}

func TestRefactorNamespaceExport(t *testing.T) {
	repo := buildTestRepo()
	assertRefactor(t, refactorSpec{
		contents: `export * as btn from './button';`,
		expected: `export * as btn from '../basic/button';`,
		importer: repo.Find("libs/ui/src/index.ts"),
		repo:     repo,
	})
}

func TestRefactorWildcardExport(t *testing.T) {
	repo := buildTestRepo()
	assertRefactor(t, refactorSpec{
		contents: `export * from './button';`,
		expected: `export * from '../basic/button';`,
		importer: repo.Find("libs/ui/src/index.ts"),
		repo:     repo,
	})
}

func buildTestRepo() *parse.Repo {
	repo := parse.NewRepo()

	libsUiSrcIndex := repo.Add("libs/ui/src/index.ts")
	libsUiBasicsIndex := repo.Add("libs/ui/basic/index.ts")
	libsStyledComponents := repo.Add("libs/styled-components/styled.ts")

	libsUiBallotsIndex := repo.Add("libs/ui/ballots/index.ts")
	repo.RegisterMove("libs/ui/src/ballots/index.ts", libsUiBallotsIndex)

	libsUiBasicsButton := repo.Add("libs/ui/basic/button.ts")
	repo.RegisterMove("libs/ui/src/button.ts", libsUiBasicsButton)

	libsUiBasicsTypography := repo.Add("libs/ui/basic/typography.ts")
	repo.RegisterMove("libs/ui/src/typography.ts", libsUiBasicsTypography)

	libsUiBasicsSelect := repo.Add("libs/ui/basic/select.ts")
	repo.RegisterMove("libs/ui/controls/select.ts", libsUiBasicsSelect)

	libsUiBasicsSideEffect := repo.Add("libs/ui/basic/side_effect.ts")
	repo.RegisterMove(
		"libs/ui/src/basic/side_effect.ts",
		libsUiBasicsSideEffect,
	)

	libsUiBallotsQrcode := repo.Add("libs/ui/ballots/qrcode.tsx")
	repo.RegisterMove("libs/ui/src/ballots/qrcode.tsx", libsUiBallotsQrcode)

	libsUiSrcIndex.RegisterExports(
		&parse.Export{
			Flags: parse.EXPORT_WILDCARD,
			From:  libsUiBasicsButton,
		},
		&parse.Export{
			Flags: parse.EXPORT_NAMED,
			From:  libsUiBasicsButton,
			Name:  "Button",
		},
		&parse.Export{
			Flags: parse.EXPORT_WILDCARD,
			From:  libsUiBasicsTypography,
		},
		&parse.Export{
			Flags: parse.EXPORT_NAMESPACE,
			From:  libsUiBasicsTypography,
			Name:  "Typography",
		},
		&parse.Export{
			Flags: parse.EXPORT_WILDCARD,
			From:  libsUiBallotsQrcode,
		},
		&parse.Export{
			Flags: parse.EXPORT_NAMED,
			From:  libsUiBallotsQrcode,
			Name:  "QrCode",
		},
	)

	libsUiBasicsIndex.RegisterExports(
		&parse.Export{
			Flags: parse.EXPORT_WILDCARD,
			From:  libsUiBasicsButton,
		},
		&parse.Export{
			Flags: parse.EXPORT_WILDCARD,
			From:  libsUiBasicsSelect,
		},
		&parse.Export{
			Flags: parse.EXPORT_WILDCARD,
			From:  libsUiBasicsTypography,
		},
		&parse.Export{
			Flags: parse.EXPORT_NAMESPACE,
			From:  libsUiBasicsTypography,
			Name:  "Typography",
		},
	)
	libsUiBasicsButton.RegisterExports(
		&parse.Export{Flags: parse.EXPORT_NAMED, Name: "Button"},
		&parse.Export{
			Flags: parse.EXPORT_NAMED | parse.EXPORT_TYPE,
			Name:  "ButtonProps",
		},
	)
	libsUiBasicsSelect.RegisterExports(
		&parse.Export{Flags: parse.EXPORT_NAMED, Name: "Select"},
	)
	libsUiBasicsTypography.RegisterExports(
		&parse.Export{Flags: parse.EXPORT_NAMED, Name: "Font"},
		&parse.Export{Flags: parse.EXPORT_NAMED, Name: "P"},
	)

	libsUiBallotsIndex.RegisterExports(&parse.Export{
		Flags: parse.EXPORT_WILDCARD,
		From:  libsUiBallotsQrcode,
	})
	libsUiBallotsQrcode.RegisterExports(
		&parse.Export{Flags: parse.EXPORT_NAMED, Name: "QrCode"},
	)

	libsGroutIndex := repo.Add("libs/grout/index.ts")
	repo.RegisterMove("libs/grout/src/index.ts", libsGroutIndex)

	libsGroutClient := repo.Add("libs/grout/client.ts")
	repo.RegisterMove("libs/grout/src/client.ts", libsGroutClient)

	libsGroutClient.RegisterExports(&parse.Export{Flags: parse.EXPORT_NAMED,
		Name: "createClient",
	})
	libsGroutIndex.RegisterExports(&parse.Export{
		Flags: parse.EXPORT_WILDCARD,
		From:  libsGroutClient,
	})

	libsStyledComponents.RegisterExports(
		&parse.Export{Flags: parse.EXPORT_DEFAULT},
		&parse.Export{
			Flags: parse.EXPORT_NAMED,
			Name:  "css",
		},
	)

	return repo
}
