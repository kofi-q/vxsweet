package datetime

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

type Timestamp struct {
	Val time.Time
}

func (self Timestamp) Add(d time.Duration) Timestamp {
	self.Val = self.Val.Add(d)
	return self
}

// Compare returns -1 if this timestamp occurs before `other`, +1 if it occurs
// after, and 0 if they are equal.
func (self Timestamp) Compare(other Timestamp) int {
	return self.Val.Compare(other.Val)
}

func (self Timestamp) MarshalJSON() ([]byte, error) {
	return json.Marshal(self.Val.UnixMilli())
}

func (self *Timestamp) Scan(src any) error {
	var ok bool
	if self.Val, ok = src.(time.Time); !ok {
		return fmt.Errorf("invalid timestamp")
	}

	return nil
}

func (self Timestamp) Sub(other Timestamp) time.Duration {
	return self.Val.Sub(other.Val)
}

func (self *Timestamp) UnmarshalJSON(data []byte) error {
	if data[0] == '"' {
		return json.Unmarshal(data, &self.Val)
	}

	var val int64
	if err := json.Unmarshal(data, &val); err != nil {
		return err
	}

	self.Val = time.UnixMilli(val)

	return nil
}

func (self Timestamp) Value() (driver.Value, error) {
	return self.Val, nil
}

func New(t time.Time) Timestamp {
	return Timestamp{Val: t}
}

func Now() Timestamp {
	return Timestamp{Val: time.Now()}
}
