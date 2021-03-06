import { expect } from 'chai';
import { Logger } from 'log4js';
import { Readable, Duplex } from 'stream';
import { FileDescriptor } from 'stryker-api/core';
import CoverageInstrumenterStream from '../../../src/coverage/CoverageInstrumenterStream';
import currentLogMock from '../../helpers/log4jsMock';
import { streamToString, readable } from '../../helpers/streamHelpers';
import { StatementMap } from 'stryker-api/test_runner';
import { Mock } from '../../helpers/producers';

describe('CoverageInstrumenterStream', () => {
  let log: Mock<Logger>;
  let sut: CoverageInstrumenterStream;
  let inputFiles: FileDescriptor[];
  const filename = 'thefile.js';

  beforeEach(() => {
    log = currentLogMock();
    inputFiles = [];
    sut = new CoverageInstrumenterStream('myCoverageVariable', filename);
  });

  it('should extend Duplex', () => expect(sut).to.be.instanceOf(Duplex));

  describe('when piped', () => {
    let input: Readable;
    let output: Promise<string>;

    beforeEach(() => {
      input = readable();
      output = streamToString(input.pipe(sut));
    });

    describe('when input is a valid javascript file', () => {
      let statementMap: StatementMap;

      beforeEach(() => {
        input.push('function something () {', 'utf8');
        input.push('}', 'utf8');
        input.push(null); // signal the end
        statementMap = { '1': { start: { line: 0, column: 0 }, end: { line: 0, column: 24 } } };
      });

      it('should instrument the input', () =>
        expect(output).to.eventually.contain('function something(){__cov_').and.contain('.f[\'1\']++'));

      it('should contain the statement map', () => output.then(() => {
        expect(sut.statementMap).to.deep.eq(statementMap);
      }));
    });

    describe('when input is invalid javascript', () => {
      const expected = 'function something {}';

      beforeEach(() => {
        input.push(expected);
        input.push(null);
        return output;
      });

      it('should just pass through the input', () => expect(output).to.eventually.eq(expected));

      it('should log the error', () => expect(log.error).to.have.been.calledWith('Error while instrumenting file "thefile.js", error was: Error: Line 1: Unexpected token {'));
    });
  });
});
