package main

import (
	"encoding/json"
	"path"
	"strings"
)

// TreeOptions — правила фильтрации и сортировки дерева (JSON от фронтенда).
type TreeOptions struct {
	// Include — если непусто, файл виден только при совпадении хотя бы
	// с одним правилом. Папки проходят всегда (кроме exclude).
	Include []string `json:"include"`
	// Exclude — путь/имя под правило не попадает; папка отсекается
	// вместе с поддеревом.
	Exclude []string `json:"exclude"`
	// Dirs — если непусто, показываются только файлы в выбранных
	// каталогах ("" означает файлы в корне проекта).
	Dirs []string `json:"dirs"`
	// Sort: "name" (по умолчанию), "name-desc", "modified".
	Sort string `json:"sort"`
}

// parseTreeOptions разбирает JSON-строку опций; "" и ошибка → без фильтра.
func parseTreeOptions(raw string) *TreeOptions {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	var opts TreeOptions
	if err := json.Unmarshal([]byte(raw), &opts); err != nil {
		return nil
	}
	if len(opts.Include) == 0 && len(opts.Exclude) == 0 && len(opts.Dirs) == 0 && opts.Sort == "" {
		return nil
	}
	return &opts
}

// underAnyDir — файл в одном из выбранных каталогов? ("" — корень проекта)
func underAnyDir(dirs []string, rel string) bool {
	for _, d := range dirs {
		d = strings.Trim(d, "/")
		if d == "" {
			// корень: файлы без вложенности
			if !strings.Contains(rel, "/") {
				return true
			}
			continue
		}
		if rel == d || strings.HasPrefix(rel, d+"/") {
			return true
		}
	}
	return false
}

// matchAny — совпадает ли путь хотя бы с одним правилом.
func matchAny(rules []string, rel string) bool {
	for _, r := range rules {
		if r = strings.TrimSpace(r); r != "" && matchGlob(r, rel) {
			return true
		}
	}
	return false
}

// matchGlob — glob-правило против относительного пути с «/».
//
// Правило без «/» сравнивается с именем (последним сегментом) на любой
// глубине: «drafts» отсечёт папку drafts где угодно, «*.tmp.md» — файлы
// с таким суффиксом в любой папке.
//
// Правило с «/» сравнивается с путём целиком от корня: «docs/**»,
// «проект/*/заметки.md». Поддерживаются ** (любое число сегментов),
// * и ? (внутри сегмента), [классы].
func matchGlob(pattern, rel string) bool {
	pattern = strings.Trim(pattern, "/")
	if pattern == "" {
		return false
	}
	if !strings.Contains(pattern, "/") {
		segs := strings.Split(rel, "/")
		ok, _ := path.Match(pattern, segs[len(segs)-1])
		return ok
	}
	return matchSegs(strings.Split(pattern, "/"), strings.Split(rel, "/"))
}

// matchSegs — сопоставление сегментов пути с шаблоном (с поддержкой **).
func matchSegs(pat, parts []string) bool {
	for {
		if len(pat) == 0 {
			return len(parts) == 0
		}
		if pat[0] == "**" {
			rest := pat[1:]
			for i := 0; i <= len(parts); i++ {
				if matchSegs(rest, parts[i:]) {
					return true
				}
			}
			return false
		}
		if len(parts) == 0 {
			return false
		}
		ok, _ := path.Match(pat[0], parts[0])
		if !ok {
			return false
		}
		pat, parts = pat[1:], parts[1:]
	}
}
