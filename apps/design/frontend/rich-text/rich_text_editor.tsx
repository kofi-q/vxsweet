// @ts-expect-error  - Joys of ESM interop
import { useEditor, EditorContent, Editor } from '@tiptap/react';
// @ts-expect-error  - Joys of ESM interop
import Bold from '@tiptap/extension-bold';
// @ts-expect-error  - Joys of ESM interop
import Italic from '@tiptap/extension-italic';
// @ts-expect-error  - Joys of ESM interop
import Underline from '@tiptap/extension-underline';
// @ts-expect-error  - Joys of ESM interop
import Strike from '@tiptap/extension-strike';
// @ts-expect-error  - Joys of ESM interop
import Text from '@tiptap/extension-text';
// @ts-expect-error  - Joys of ESM interop
import Document from '@tiptap/extension-document';
// @ts-expect-error  - Joys of ESM interop
import Paragraph from '@tiptap/extension-paragraph';
// @ts-expect-error  - Joys of ESM interop
import HardBreak from '@tiptap/extension-hard-break';
// @ts-expect-error  - Joys of ESM interop
import BulletList from '@tiptap/extension-bullet-list';
// @ts-expect-error  - Joys of ESM interop
import OrderedList from '@tiptap/extension-ordered-list';
// @ts-expect-error  - Joys of ESM interop
import ListItem from '@tiptap/extension-list-item';
// @ts-expect-error  - Joys of ESM interop
import Image from '@tiptap/extension-image';
// @ts-expect-error  - Joys of ESM interop
import Table from '@tiptap/extension-table';
// @ts-expect-error  - Joys of ESM interop
import TableCell from '@tiptap/extension-table-cell';
// @ts-expect-error  - Joys of ESM interop
import TableRow from '@tiptap/extension-table-row';
// @ts-expect-error  - Joys of ESM interop
import TableHeader from '@tiptap/extension-table-header';
// @ts-expect-error  - Joys of ESM interop
import Dropcursor from '@tiptap/extension-dropcursor';
// @ts-expect-error  - Joys of ESM interop
import Gapcursor from '@tiptap/extension-gapcursor';
// @ts-expect-error  - Joys of ESM interop
import History from '@tiptap/extension-history';
import {
  Button,
  type ButtonProps,
  Icons,
  richTextStyles,
} from '@vx/libs/ui/src';
import styled from 'styled-components';
import React from 'react';
import { Buffer } from 'node:buffer';
import { ImageInputButton } from '../image-input/image_input';

const StyledEditor = styled.div`
  cursor: text;
  border: ${(p) => p.theme.sizes.bordersRem.thin}rem solid
    ${(p) => p.theme.colors.outline};
  background: ${(p) => p.theme.colors.containerLow};
  padding: 0.5rem;
  line-height: ${(p) => p.theme.sizes.lineHeight};
  border-radius: ${(p) => p.theme.sizes.borderRadiusRem}rem;

  &:focus-within {
    background: none;
    outline: var(--focus-outline);
  }

  .tiptap {
    outline: none;
    padding: 1rem 0 0.5rem;

    /* Ensure we can see the cursor in an empty table cell by giving it a min width */
    table {
      td,
      th {
        min-width: 1.5rem;
      }
    }

    ${richTextStyles}
  }

  overflow: auto;
`;

const StyledToolbar = styled.div`
  display: flex;
  gap: 0.25rem;

  button,
  label {
    padding: 0.25rem 0.5rem;
    gap: 0.25rem;
  }
`;

const ControlGroup = styled.div`
  display: flex;
  gap: 0.125rem;
  border: ${(p) => p.theme.sizes.bordersRem.thin}rem solid
    ${(p) => p.theme.colors.outline};
  border-radius: ${(p) => p.theme.sizes.borderRadiusRem}rem;
`;

function ControlButton({
  isActive,
  ...props
}: { isActive?: boolean } & ButtonProps) {
  return (
    <Button
      color={isActive ? 'primary' : 'neutral'}
      fill={isActive ? 'tinted' : 'transparent'}
      {...props}
    />
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <StyledToolbar>
      <ControlGroup>
        <ControlButton
          icon="Bold"
          aria-label="Bold"
          isActive={editor.isActive('bold')}
          onPress={() => editor.chain().focus().toggleBold().run()}
        />
        <ControlButton
          icon="Italic"
          aria-label="Italic"
          isActive={editor.isActive('italic')}
          onPress={() => editor.chain().focus().toggleItalic().run()}
        />
        <ControlButton
          icon="Underline"
          aria-label="Underline"
          isActive={editor.isActive('underline')}
          onPress={() => editor.chain().focus().toggleUnderline().run()}
        />
        <ControlButton
          icon="Strikethrough"
          aria-label="Strikethrough"
          isActive={editor.isActive('strike')}
          onPress={() => editor.chain().focus().toggleStrike().run()}
        />
      </ControlGroup>
      <ControlGroup>
        <ControlButton
          icon="ListUnordered"
          aria-label="Bullet List"
          isActive={editor.isActive('bulletList')}
          onPress={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ControlButton
          icon="ListOrdered"
          aria-label="Number List"
          isActive={editor.isActive('orderedList')}
          onPress={() => editor.chain().focus().toggleOrderedList().run()}
        />
      </ControlGroup>
      <ControlGroup>
        <ImageInputButton
          buttonProps={{
            fill: 'transparent',
          }}
          onChange={(svgImage) => {
            editor
              .chain()
              .focus()
              .setImage({
                src: `data:image/svg+xml;base64,${Buffer.from(
                  svgImage
                ).toString('base64')}`,
              })
              .run();
          }}
          aria-label="Insert Image"
        >
          <Icons.Image />
        </ImageInputButton>
      </ControlGroup>

      <ControlGroup>
        <ControlButton
          icon="Table"
          aria-label="Table"
          isActive={editor.isActive('table')}
          onPress={() =>
            editor.isActive('table')
              ? editor.chain().focus().deleteTable().run()
              : editor
                  .chain()
                  .focus()
                  .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                  .run()
          }
        />
        {editor.isActive('table') && (
          <React.Fragment>
            <ControlButton
              icon={
                <React.Fragment>
                  <Icons.Add />
                  <Icons.LinesHorizontal />
                </React.Fragment>
              }
              aria-label="Add Row"
              onPress={() => editor.chain().focus().addRowAfter().run()}
            />
            <ControlButton
              icon={
                <React.Fragment>
                  <Icons.Delete />
                  <Icons.LinesHorizontal />
                </React.Fragment>
              }
              aria-label="Remove Row"
              onPress={() => editor.chain().focus().deleteRow().run()}
            />
            <ControlButton
              icon={
                <React.Fragment>
                  <Icons.Add />
                  <Icons.LinesVertical />
                </React.Fragment>
              }
              aria-label="Add Column"
              onPress={() => editor.chain().focus().addColumnAfter().run()}
            />
            <ControlButton
              icon={
                <React.Fragment>
                  <Icons.Delete />
                  <Icons.LinesVertical />
                </React.Fragment>
              }
              aria-label="Remove Column"
              onPress={() => editor.chain().focus().deleteColumn().run()}
            />
          </React.Fragment>
        )}
      </ControlGroup>
    </StyledToolbar>
  );
}

interface RichTextEditorProps {
  initialHtmlContent: string;
  onChange: (htmlContent: string) => void;
}

export function RichTextEditor({
  initialHtmlContent,
  onChange,
}: RichTextEditorProps): JSX.Element {
  const editor = useEditor({
    extensions: [
      Document,
      Text,
      Paragraph,
      HardBreak,
      Bold,
      Italic,
      Underline,
      Strike,
      BulletList,
      OrderedList,
      ListItem,
      Image.configure({ allowBase64: true }),
      Table.configure({
        // The default minWidth adds style to the HTML output, which we don't
        // want. We add some display styles in our own CSS to give a minWidth,
        // which is needed to be able to see the cursor inside an empty table
        // cell.
        cellMinWidth: 0,
      }),
      TableCell,
      TableRow,
      TableHeader,
      Dropcursor,
      Gapcursor,
      History,
    ],
    content: initialHtmlContent,
    onUpdate: (update) => {
      onChange(update.editor.getHTML());
    },
  });
  return (
    <StyledEditor
      data-testid="rich-text-editor"
      onClick={() => editor?.chain().focus().run()}
    >
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </StyledEditor>
  );
}
