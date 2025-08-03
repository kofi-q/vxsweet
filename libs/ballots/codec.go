package ballots

import (
	"cmp"
	"fmt"
	"log"
	"math/bits"
	"slices"

	"github.com/bearmini/bitstream-go"
	"github.com/kofi-q/vxsweet/libs/elections"
)

type BallotType uint8

const (
	BallotHashEncodingLen = 20
)

var (
	ballotTypesOrdered = [...]elections.BallotType{
		elections.BallotTypePrecinct,
		elections.BallotTypeAbsentee,
		elections.BallotTypeProvisional,
	}

	nBitsBallotStyleIndex = uint8(bits.Len16(4096))
	nBitsPageNumber       = uint8(bits.Len16(30))
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

type StrEncoding struct {
	dict []byte
}

var (
	StrEncodingHex = NewStrEncoding([]byte("0123456789abcdef"))
)

func NewStrEncoding(dict []byte) (enc StrEncoding) {
	enc.dict = make([]byte, len(dict))
	copy(enc.dict, dict)

	enc.dict = slices.Compact(enc.dict)
	slices.Sort(enc.dict)

	if len(enc.dict) > 256 {
		log.Panicln("character set too large:", len(enc.dict))
	}

	return
}

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

	return e.writer.WriteNBitsOfUint16BE(nBitsBallotStyleIndex, uint16(i))
}

func (e *Encoder) WriteHash(hash string) error {
	return e.WriteHex(hash[0:BallotHashEncodingLen])
}

func (e *Encoder) WriteHex(str string) error {
	return e.WriteStringEnc(StrEncodingHex, str)
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

func (e *Encoder) WriteString(str string) error {
	const maxLen = uint8(0xff)
	strLen := uint8(len(str))
	if strLen > maxLen {
		return fmt.Errorf("expected string len <= %d, got: %d", maxLen, strLen)
	}

	return cmp.Or(
		e.writer.WriteUint8(strLen),
		e.Write([]byte(str)),
	)
}

func (e *Encoder) WriteStringEnc(enc StrEncoding, str string) error {
	bitWidth := bits.Len8(uint8(len(enc.dict)))
	for _, char := range []byte(str) {
		i := slices.Index(enc.dict, char)
		if i == -1 {
			return fmt.Errorf("invalid char %c for given encoding", char)
		}

		err := e.writer.WriteNBitsOfUint8(uint8(bitWidth), uint8(i))
		if err != nil {
			return err
		}
	}

	return nil
}
