jest.mock('./rust_addon');

import { ImageData } from 'canvas';
import * as electionGridLayoutNewHampshireTestBallotFixtures from '@vx/libs/fixtures/src/data/electionGridLayoutNewHampshireTestBallot';
import { interpret as interpretImpl } from './rust_addon';
import { interpret } from './interpret';

const interpretImplMock = interpretImpl as jest.MockedFunction<
  typeof interpretImpl
>;

let frontImageData!: ImageData;
let backImageData!: ImageData;

beforeAll(async () => {
  frontImageData =
    await electionGridLayoutNewHampshireTestBallotFixtures.scanMarkedFront.asImageData();
  backImageData =
    await electionGridLayoutNewHampshireTestBallotFixtures.scanMarkedBack.asImageData();
});

test('no debug', () => {
  interpretImplMock.mockReturnValue({
    success: false,
    value: '{}',
  });

  void interpret(
    electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionDefinition(),
    ['a.jpeg', 'b.jpeg'],
    { debug: false }
  );

  expect(interpretImplMock).toHaveBeenCalledWith(
    electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionDefinition()
      .election,
    'a.jpeg',
    'b.jpeg',
    undefined,
    undefined,
    expect.any(Object)
  );
});

test('empty debug paths', () => {
  interpretImplMock.mockReturnValue({
    success: false,
    value: '{}',
  });

  void interpret(
    electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionDefinition(),
    [frontImageData, backImageData],
    // @ts-expect-error -- intentionally passing invalid data
    { debugBasePaths: [] }
  );

  expect(interpretImplMock).toHaveBeenCalledWith(
    electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionDefinition()
      .election,
    frontImageData,
    backImageData,
    undefined,
    undefined,
    expect.any(Object)
  );
});

test('undefined debug paths', () => {
  interpretImplMock.mockReturnValue({
    success: false,
    value: '{}',
  });

  void interpret(
    electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionDefinition(),
    [frontImageData, backImageData],
    { debugBasePaths: undefined }
  );

  expect(interpretImplMock).toHaveBeenCalledWith(
    electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionDefinition()
      .election,
    frontImageData,
    backImageData,
    undefined,
    undefined,
    expect.any(Object)
  );
});

test('debug with image paths', () => {
  interpretImplMock.mockReturnValue({
    success: false,
    value: '{}',
  });

  void interpret(
    electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionDefinition(),
    ['a.jpeg', 'b.jpeg'],
    { debug: true }
  );

  expect(interpretImplMock).toHaveBeenCalledWith(
    electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionDefinition()
      .election,
    'a.jpeg',
    'b.jpeg',
    'a.jpeg',
    'b.jpeg',
    expect.any(Object)
  );
});

test('debug with image data', () => {
  interpretImplMock.mockReturnValue({
    success: false,
    value: '{}',
  });

  void interpret(
    electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionDefinition(),
    [frontImageData, backImageData],
    { debugBasePaths: ['a.jpeg', 'b.jpeg'] }
  );

  expect(interpretImplMock).toHaveBeenCalledWith(
    electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionDefinition()
      .election,
    frontImageData,
    backImageData,
    'a.jpeg',
    'b.jpeg',
    expect.any(Object)
  );
});
