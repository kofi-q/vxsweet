package hmpb

import (
	"bytes"
	"cmp"

	"github.com/bearmini/bitstream-go"
	"github.com/kofi-q/vxsweet/libs/ballots"
	"github.com/kofi-q/vxsweet/libs/elections"
)

const (
	HmpbPrelude = "VP2"
)

type MetadataEncoded struct {
	Pages [][]byte
}

type Metadata struct {
	Hash          string
	BallotId      string
	BallotStyleId string
	BallotType    elections.BallotType
	PrecinctId    string

	Official  bool
	PageCount uint8
}

func EncodeMetadata(
	election *elections.Election,
	metadata Metadata,
) (MetadataEncoded, error) {
	preamble := bytes.NewBuffer(make([]byte, 0, 32))
	writer := bitstream.NewWriter(preamble)
	enc := ballots.NewEncoder(election, writer)

	err := cmp.Or(
		enc.Write([]byte(HmpbPrelude)),
		enc.WriteHash(metadata.Hash),
		enc.WritePrecinctIndex(metadata.PrecinctId),
		enc.WriteBallotStyleIndex(metadata.BallotStyleId),
		writer.Flush(),
	)
	if err != nil {
		return MetadataEncoded{}, err
	}

	result := MetadataEncoded{Pages: make([][]byte, metadata.PageCount)}

	lenPreamble := len(preamble.Bytes())
	// [TODO] Get this from the base encoder:
	lenEncodedTotal := lenPreamble + 1 + len(metadata.BallotId) + 1
	for ixPage := range metadata.PageCount {
		pageStream := bytes.NewBuffer(make([]byte, 0, lenEncodedTotal))
		pageWriter := bitstream.NewWriter(pageStream)
		pageEnc := ballots.NewEncoder(election, pageWriter)

		err = cmp.Or(
			pageWriter.WriteNBits(writer.WrittenBits(), preamble.Bytes()),
			pageEnc.WritePageNumber(ixPage+1),
			pageWriter.WriteBool(!metadata.Official),
			pageEnc.WriteBallotTypeIndex(metadata.BallotType),
			pageWriter.WriteBool(metadata.BallotId != ""),
			pageEnc.WriteString(metadata.BallotId),
			writer.Flush(),
		)
		if err != nil {
			return MetadataEncoded{}, err
		}

		result.Pages[ixPage] = pageStream.Bytes()
	}

	return result, nil

}
