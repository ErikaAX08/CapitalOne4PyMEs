package domain

import (
	"crypto/rand"
	"time"
)

// crockford is the Base32 alphabet ULIDs use: the digits and the uppercase
// letters minus I, L, O and U, so a transcribed identifier cannot be misread.
const crockford = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

// NewULID returns a 26-character ULID: 48 bits of millisecond timestamp encoded
// in the first ten characters, 80 bits of randomness in the remaining sixteen.
//
// The identifiers of docs/data-model.md are ULIDs stored as CHAR(26). They are
// generated here rather than by the database because the movement exists as a
// domain object before any adapter sees it, and because sorting by identifier
// then sorts by creation time.
func NewULID(t time.Time) string {
	var id [26]byte

	ms := uint64(t.UTC().UnixMilli())
	for i := 9; i >= 0; i-- {
		id[i] = crockford[ms&31]
		ms >>= 5
	}

	var entropy [10]byte
	if _, err := rand.Read(entropy[:]); err != nil {
		// crypto/rand.Read never returns an error on the platforms this runs
		// on; if it ever did, a predictable identifier is worse than a panic.
		panic("movements: no entropy available for a ULID: " + err.Error())
	}
	// Ten bytes are eighty bits, which is exactly sixteen groups of five. Each
	// group is read from a sixteen-bit window so a group may straddle two bytes.
	for i := range 16 {
		bit := i * 5
		at := bit / 8
		offset := bit % 8
		window := uint16(entropy[at]) << 8
		if at+1 < len(entropy) {
			window |= uint16(entropy[at+1])
		}
		id[10+i] = crockford[(window>>(11-offset))&31]
	}
	return string(id[:])
}
