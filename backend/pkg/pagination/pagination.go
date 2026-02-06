package pagination

// Params holds pagination parameters from query strings.
type Params struct {
	Limit  int
	Offset int
}

func NewParams(limit, offset int) Params {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	return Params{Limit: limit, Offset: offset}
}

// PagedResult wraps a slice of items with pagination metadata.
type PagedResult[T any] struct {
	Items      []T `json:"items"`
	TotalCount int `json:"total_count"`
	Limit      int `json:"limit"`
	Offset     int `json:"offset"`
}
