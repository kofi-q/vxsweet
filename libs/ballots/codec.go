package ballots

import (
	"cmp"
	"fmt"
	"math/bits"
	"slices"

	"github.com/bearmini/bitstream-go"
	"github.com/kofi-q/vxsweet/libs/elections"
)

type BallotType uint8

const (
	BallotHashEncodingLen = 10
)

var (
	ballotTypesOrdered = [...]elections.BallotType{
		elections.BallotTypePrecinct,
		elections.BallotTypeAbsentee,
		elections.BallotTypeProvisional,
	}

	nBitsBallotStyleIndex = uint8(bits.Len16(4096))
	nBitsPageNumber       = uint8(bits.Len8(30))
	nBitsBallotTypeIndex  = uint8(4)
	nBitsPrecinctIndex    = uint8(bits.Len16(4096))
)

type Encoder struct {
	election *elections.Election
	writer   *bitstream.Writer
}

func NewEncoder(
	election *elections.Election,
	writer *bitstream.Writer,
) Encoder {
	return Encoder{
		election: election,
		writer:   writer,
	}
}

type StrEncoding string

const (
	StrEncodingWriteIn StrEncoding = `ABCDEFGHIJKLMNOPQRSTUVWXYZ \'"-.,`
)

func (e *Encoder) Write(data []byte) error {
	for _, b := range data {
		if err := e.writer.WriteUint8(b); err != nil {
			return err
		}
	}

	return nil
}

func (e *Encoder) WriteBallotStyleIndex(id string) error {
	for i, style := range e.election.BallotStyles {
		if style.Id != id {
			continue
		}

		return e.writer.WriteNBitsOfUint16BE(nBitsBallotStyleIndex, uint16(i))
	}

	return fmt.Errorf("ballot style not found for ID: %s", id)
}

func (e *Encoder) WriteBallotTypeIndex(typ elections.BallotType) error {
	i := slices.Index(ballotTypesOrdered[:], typ)
	if i == -1 {
		return fmt.Errorf("ballot type not found: %s", typ)
	}

	return e.writer.WriteNBitsOfUint8(nBitsBallotTypeIndex, uint8(i))
}

func (e *Encoder) WriteHash(hash []byte) error {
	return e.Write(hash[0:BallotHashEncodingLen])
}

func (e *Encoder) WritePageNumber(num uint8) error {
	return e.writer.WriteNBitsOfUint8(nBitsPageNumber, num)
}

func (e *Encoder) WritePrecinctIndex(id string) error {
	for i, precinct := range e.election.Precincts {
		if precinct.Id != id {
			continue
		}

		return e.writer.WriteNBitsOfUint16BE(nBitsPrecinctIndex, uint16(i))
	}

	return fmt.Errorf("precinct not found for ID: %s", id)
}

type strEncodeFlags uint8

const (
	StrEncodeOmitEmpty strEncodeFlags = 1 << iota
)

func (e *Encoder) WriteString(str string, opts strEncodeFlags) error {
	const maxLen = uint8(0xff)
	strLen := uint8(len(str))
	if strLen > maxLen {
		return fmt.Errorf("expected string len <= %d, got: %d", maxLen, strLen)
	}

	if opts&StrEncodeOmitEmpty != 0 && strLen == 0 {
		return nil
	}

	return cmp.Or(
		e.writer.WriteUint8(strLen),
		e.Write([]byte(str)),
	)
}

func (e *Encoder) WriteStringEnc(enc StrEncoding, str string) error {
	bitWidth := bits.Len8(uint8(len(enc) - 1))

	for ixChar := range len(str) {
		ixMapped, found := slices.BinarySearch([]byte(enc), str[ixChar])
		if !found {
			return fmt.Errorf("invalid char %c for given encoding", str[ixChar])
		}

		err := e.writer.WriteNBitsOfUint8(uint8(bitWidth), uint8(ixMapped))
		if err != nil {
			return err
		}
	}

	return nil
}
