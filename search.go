package main

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type SearchHit struct {
	Line int    `json:"line"`
	Text string `json:"text"`
}

type SearchFileResult struct {
	Path  string      `json:"path"`
	Count int         `json:"count"`
	Hits  []SearchHit `json:"hits"`
}

type SearchAllResult struct {
	Files     []SearchFileResult `json:"files"`
	Total     int                `json:"total"`
	FileCount int                `json:"fileCount"`
	Truncated bool               `json:"truncated"`
	Ms        int64              `json:"ms"`
}

const (
	maxHitsPerFile = 30
	maxFilesInRes  = 100
	maxTotalHits   = 1500
	maxIndexedFile = 4 << 20
)

// SearchAll ищет подстроку по всем md-файлам проекта (без учёта регистра).
func (a *App) SearchAll(root, query string) (*SearchAllResult, error) {
	needle := strings.ToLower(strings.TrimSpace(query))
	res := &SearchAllResult{}
	if needle == "" {
		return res, nil
	}
	start := time.Now()
	lines, err := a.getLines(root)
	if err != nil {
		return nil, err
	}
	rels := make([]string, 0, len(lines))
	for rel := range lines {
		rels = append(rels, rel)
	}
	sort.Strings(rels)
	for _, rel := range rels {
		fr := SearchFileResult{Path: rel}
		for i, line := range lines[rel] {
			if strings.Contains(strings.ToLower(line), needle) {
				text := strings.TrimSpace(strings.TrimSuffix(line, "\r"))
				if text == "" {
					text = "…"
				}
				fr.Hits = append(fr.Hits, SearchHit{Line: i + 1, Text: clip(text, 240)})
				fr.Count++
				if len(fr.Hits) >= maxHitsPerFile {
					break
				}
			}
		}
		if fr.Count > 0 {
			res.Files = append(res.Files, fr)
			res.Total += fr.Count
			res.FileCount++
		}
		if res.Total >= maxTotalHits || res.FileCount >= maxFilesInRes {
			res.Truncated = true
			break
		}
	}
	res.Ms = time.Since(start).Milliseconds()
	return res, nil
}

// SearchFiles возвращает md-файлы, подходящие под запрос (Ctrl+P).
// Пустой запрос → все файлы, недавние не учитываются (их сортирует фронтенд).
func (a *App) SearchFiles(root, query string) ([]string, error) {
	lines, err := a.getLines(root)
	if err != nil {
		return nil, err
	}
	q := strings.ToLower(strings.TrimSpace(query))
	type scored struct {
		rel   string
		score int
	}
	var out []scored
	for rel := range lines {
		lower := strings.ToLower(rel)
		base := lowerName(filepath.Base(rel))
		s := -1
		switch {
		case q == "":
			s = 3
		case strings.HasPrefix(base, q):
			s = 0
		case strings.Contains(base, q):
			s = 1
		case strings.Contains(lower, q):
			s = 2
		}
		if s >= 0 {
			out = append(out, scored{rel, s})
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].score != out[j].score {
			return out[i].score < out[j].score
		}
		return out[i].rel < out[j].rel
	})
	if len(out) > 100 {
		out = out[:100]
	}
	files := make([]string, len(out))
	for i, o := range out {
		files[i] = o.rel
	}
	return files, nil
}

// getLines возвращает построчное содержимое всех md-файлов проекта (с кэшем).
func (a *App) getLines(root string) (map[string][]string, error) {
	a.searchMu.Lock()
	defer a.searchMu.Unlock()
	root = filepath.Clean(root)
	if a.searchIdx != nil && a.searchRoot == root && !a.searchStale {
		return a.searchIdx, nil
	}
	idx := make(map[string][]string)
	_ = filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() {
			if _, skip := skipDirs[lowerName(d.Name())]; skip && path != root {
				return filepath.SkipDir
			}
			return nil
		}
		if !isMarkdown(d.Name()) {
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return nil
		}
		data, err := os.ReadFile(path)
		if err != nil || len(data) > maxIndexedFile {
			return nil
		}
		idx[filepath.ToSlash(rel)] = strings.Split(decodeText(data), "\n")
		return nil
	})
	a.searchIdx = idx
	a.searchRoot = root
	a.searchStale = false
	return idx, nil
}

func clip(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n]) + "…"
}
