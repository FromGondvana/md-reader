package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ReplaceInFiles заменяет query на replacement в указанных md-файлах
// проекта (список rel-путей от фронтенда — обычно результат SearchAll).
// Возвращает число замен. caseSensitive — с учётом регистра.
func (a *App) ReplaceInFiles(root, query, replacement string, files []string, caseSensitive bool) (int64, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return 0, fmt.Errorf("пустой поисковый запрос")
	}
	var total int64
	var firstErr error
	for _, rel := range files {
		if !isMarkdown(rel) {
			continue
		}
		n, err := replaceInFile(root, rel, query, replacement, caseSensitive)
		if err != nil {
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		total += n
	}
	// кэш поискового индекса больше не актуален
	a.searchMu.Lock()
	a.searchStale = true
	a.searchMu.Unlock()
	if firstErr != nil {
		return total, firstErr
	}
	return total, nil
}

func replaceInFile(root, rel, query, replacement string, caseSensitive bool) (int64, error) {
	p := absPath(root, rel)
	fi, err := os.Stat(p)
	if err != nil || fi.IsDir() || fi.Size() > maxFileBytes {
		return 0, fmt.Errorf("файл недоступен: %s", rel)
	}
	data, err := os.ReadFile(p)
	if err != nil {
		return 0, err
	}
	content := decodeText(data)
	n := int64(0)
	var out string
	if caseSensitive {
		n = int64(strings.Count(content, query))
		if n == 0 {
			return 0, nil
		}
		out = strings.ReplaceAll(content, query, replacement)
	} else {
		out, n = replaceAllInsensitive(content, query, replacement)
		if n == 0 {
			return 0, nil
		}
	}
	// атомарная запись — как в WriteFile
	tmp, err := os.CreateTemp(filepath.Dir(p), ".mdr-tmp-*")
	if err != nil {
		return 0, err
	}
	tmpName := tmp.Name()
	_, err = tmp.WriteString(out)
	if cerr := tmp.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		os.Remove(tmpName)
		return 0, err
	}
	if err := os.Rename(tmpName, p); err != nil {
		os.Remove(tmpName)
		return 0, err
	}
	return n, nil
}

// replaceAllInsensitive — замена подстроки без учёта регистра.
func replaceAllInsensitive(s, query, replacement string) (string, int64) {
	needle := strings.ToLower(query)
	var sb strings.Builder
	var count int64
	for {
		idx := strings.Index(strings.ToLower(s), needle)
		if idx < 0 {
			sb.WriteString(s)
			break
		}
		sb.WriteString(s[:idx])
		sb.WriteString(replacement)
		s = s[idx+len(query):]
		count++
	}
	return sb.String(), count
}
