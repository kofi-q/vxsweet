import { err, ok, type Result } from '@vx/libs/basics/result';
import { findDocForProperty, findDocForType } from './docs';
import {
  createInterfaceFromDefinition,
  createEnumFromDefinition,
  parseJsonSchema,
} from './json_schema';
import { type Enum, type Interface, type StringAlias } from './types';
import {
  makeIdentifier,
  isValidIdentifier,
  renderTypeAsDeclaration,
  renderTypeAsZodSchema,
} from './util';
import { extractDocumentationForSchema, parseXsdSchema } from './xsd';

function writeDocumentation(
  documentation: string | undefined,
  out: NodeJS.WritableStream,
  indent = ''
): void {
  if (!documentation) {
    return;
  }

  const lines = documentation.split('\n');
  out.write(`${indent}/**\n`);
  for (const line of lines) {
    out.write(`${indent} * ${line}\n`);
  }
  out.write(`${indent} */\n`);
}

function writeEnumType(enumeration: Enum, out: NodeJS.WritableStream): void {
  writeDocumentation(enumeration.documentation, out);

  out.write(`export enum ${enumeration.name} {`);

  if (enumeration.values.length > 0) {
    out.write(`\n`);
  }

  for (const [i, { documentation, value }] of enumeration.values.entries()) {
    writeDocumentation(documentation, out, '  ');
    out.write(`  ${makeIdentifier(value)} = '${value}',\n`);
    if (i !== enumeration.values.length - 1) {
      out.write('\n');
    }
  }

  out.write(`}\n\n`);

  writeDocumentation(`Schema for {@link ${enumeration.name}}.`, out);
  out.write(
    `export const ${enumeration.name}Schema = z.nativeEnum(${enumeration.name});\n\n`
  );
}

function writeInterfaceType(
  interfaceType: Interface,
  out: NodeJS.WritableStream
): void {
  writeDocumentation(interfaceType.documentation, out);

  out.write(`export interface ${interfaceType.name} {\n`);

  for (const [i, property] of interfaceType.properties.entries()) {
    writeDocumentation(property.documentation, out, '  ');

    out.write(
      `  readonly ${
        !isValidIdentifier(property.name) ? `'${property.name}'` : property.name
      }${property.required ? '' : '?'}: ${renderTypeAsDeclaration(
        property.type
      )};\n`
    );

    if (i !== interfaceType.properties.length - 1) {
      out.write('\n');
    }
  }

  out.write(`}\n\n`);

  writeDocumentation(`Schema for {@link ${interfaceType.name}}.`, out);
  out.write(
    `export const ${interfaceType.name}Schema: z.ZodSchema<${interfaceType.name}> = z.object({\n`
  );

  for (const property of interfaceType.properties) {
    const schema = renderTypeAsZodSchema(property.type);
    out.write(
      `  ${
        !isValidIdentifier(property.name) ? `'${property.name}'` : property.name
      }: ${property.required ? schema : `z.optional(${schema})`},\n`
    );
  }

  out.write(`});\n\n`);
}

function writeStringAlias(
  stringAlias: StringAlias,
  out: NodeJS.WritableStream
): void {
  writeDocumentation(stringAlias.documentation, out);
  out.write(`export type ${stringAlias.name} = string;\n\n`);

  writeDocumentation(`Schema for {@link ${stringAlias.name}}.`, out);
  out.write(
    `export const ${stringAlias.name}Schema: z.ZodSchema<${stringAlias.name}> = z.string()`
  );
  if (stringAlias.pattern) {
    out.write(`.regex(/${stringAlias.pattern.replace(/\//g, '\\/')}/)`);
  }
  out.write(';\n\n');
}

/**
 * Builds TypeScript interfaces and Zod schemas from an XSD schema.
 */
export function buildSchema(
  xsdSchema: string,
  jsonSchema: string,
  out: NodeJS.WritableStream
): Result<void, Error> {
  out.write(`// DO NOT EDIT THIS FILE. IT IS GENERATED AUTOMATICALLY.\n\n`);
  out.write(`/* eslint-disable */\n\n`);
  out.write(`import { z } from 'zod';\n\n`);
  out.write(`import check8601 from '@antongolub/iso8601';\n\n`);
  out.write(`const Iso8601Date = z
  .string()
  .refine(check8601, 'dates must be in ISO8601 format');\n\n`);

  writeDocumentation('Type for xsd:datetime values.', out);
  out.write(`export type DateTime = z.TypeOf<typeof Iso8601Date>;\n\n`);

  writeDocumentation('Schema for {@link DateTime}.', out);
  out.write(`export const DateTimeSchema = Iso8601Date;\n\n`);

  writeDocumentation('Type for xsd:date values.', out);
  out.write(`export type Date = z.TypeOf<typeof Iso8601Date>;\n\n`);

  writeDocumentation('Schema {@link Date}.', out);
  out.write(`export const DateSchema = Iso8601Date;\n\n`);

  writeDocumentation('A URI/URL.', out);
  out.write(`export type Uri = string;\n\n`);

  writeDocumentation('Schema for {@link Uri}.', out);
  out.write(`export const UriSchema = z.string();\n\n`);

  writeDocumentation('Byte data stored in a string.', out);
  out.write(`export type Byte = string;\n\n`);

  writeDocumentation('Schema for {@link Byte}.', out);
  out.write(`export const ByteSchema = z.string();\n\n`);

  writeDocumentation(
    'An integer number, i.e. a whole number without fractional part.',
    out
  );
  out.write(`export type integer = number;\n\n`);

  writeDocumentation('Schema for {@link integer}.', out);
  out.write(`export const integerSchema = z.number().int();\n\n`);

  const xsd = parseXsdSchema(xsdSchema);
  const json = parseJsonSchema(jsonSchema);
  const jsonSchemaObject = json.ok();

  if (!jsonSchemaObject || !jsonSchemaObject.definitions) {
    return err(json.err() ?? new Error('JSON schema is missing definitions'));
  }

  const docs = extractDocumentationForSchema(xsd);
  const enums: Enum[] = [];
  const aliases: StringAlias[] = [];
  const interfaces: Interface[] = [];

  for (const [name, def] of Object.entries(jsonSchemaObject.definitions)) {
    const localName = name.split('.').pop() as string;
    if (def.enum) {
      const jsonEnum = createEnumFromDefinition(localName, def);

      if (jsonEnum) {
        enums.push(jsonEnum);
      }
    } else if (def.type === 'object') {
      const jsonInterface = createInterfaceFromDefinition(localName, def);

      if (jsonInterface) {
        interfaces.push(jsonInterface);
      }
    } else if (def.type === 'string') {
      aliases.push({
        kind: 'string',
        name: localName,
        pattern: def.pattern,
        documentation: def.description,
      });
    }
  }

  for (const alias of aliases) {
    alias.documentation ??= findDocForType(docs, alias.name)?.documentation;
  }

  for (const enumeration of enums) {
    enumeration.documentation ??= findDocForType(docs, enumeration.name)
      ?.documentation;

    for (const enumValue of enumeration.values) {
      // There's no way to add a description to an enum value in JSON schema.
      enumValue.documentation = findDocForProperty(
        docs,
        enumeration.name,
        enumValue.value
      )?.documentation;
    }
  }

  for (const iface of interfaces) {
    iface.documentation ??= findDocForType(docs, iface.name)?.documentation;

    for (const property of iface.properties) {
      property.documentation ??= findDocForProperty(
        docs,
        iface.name,
        property.name
      )?.documentation;
    }
  }

  for (const stringAlias of aliases) {
    writeStringAlias(stringAlias, out);
  }

  for (const jsonEnum of enums) {
    writeEnumType(jsonEnum, out);
  }

  for (const jsonInterface of interfaces) {
    writeInterfaceType(jsonInterface, out);
  }

  return ok();
}
