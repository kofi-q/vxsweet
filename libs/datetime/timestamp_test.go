package datetime

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestTimestampRoundtrip(t *testing.T) {
	now := time.Now()
	js, err := json.Marshal(Timestamp{Val: now})
	require.NoError(t, err)

	require.Equal(t, fmt.Sprintf("%d", now.UnixMilli()), string(js))

	var roundtripped Timestamp
	require.NoError(t, json.Unmarshal(js, &roundtripped))
	require.Equal(t, now.UnixMilli(), roundtripped.Val.UnixMilli())
}

func TestTimestampUnmarshalIsoDateString(t *testing.T) {
	now := time.Now()
	iso, err := json.Marshal(now)
	require.NoError(t, err)

	var parsed Timestamp
	require.NoError(t, json.Unmarshal(iso, &parsed))
	require.Equal(t, now.UnixMilli(), parsed.Val.UnixMilli())
}
