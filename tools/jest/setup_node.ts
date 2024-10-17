jest.mock('nanoid', () => ({
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  customAlphabet: () => () => idFactory.next(),
}));

function makeIdFactory() {
  let id = 0;
  return {
    next: () => {
      id += 1;
      return `test-random-id-${id}`;
    },
    reset: () => {
      id = 0;
    },
  };
}

// Deterministic ID generation
const idFactory = makeIdFactory();

beforeEach(() => {
  idFactory.reset();
});
