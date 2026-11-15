package main

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// FileNode — элемент дерева файлов (JSON для фронтенда).
type FileNode struct {
	Name       string      `json:"name"`
	Path       string      `json:"path"` // относительный, с «/»
	IsDir      bool        `json:"isDir"`
	ModifiedAt int64       `json:"modifiedAt,omitempty"` // для сортировки по дате
	Children   []*FileNode `json:"children,omitempty"`
}

// Папки, которые не показываем в дереве и не индексируем.
var skipDirs = map[string]struct{}{
	".git": {}, "node_modules": {}, "dist": {}, "build": {}, "out": {},
	"target": {}, "vendor": {}, "__pycache__": {}, ".venv": {}, "venv": {},
	".idea": {}, ".vscode": {}, ".next": {}, ".output": {}, ".cache": {},
	".svelte-kit": {}, "coverage": {}, "bin": {}, "obj": {}, ".gradle": {},
	".wails": {}, ".terraform": {}, ".pytest_cache": {}, ".mypy_cache": {},
	".nuxt": {}, ".angular": {}, ".vercel": {}, ".parcel-cache": {},
	"backups": {}, ".ruff_cache": {},
}

// LoadTree строит дерево md-файлов проекта (относительные пути с «/»).
// optsJSON — необязательная маска (TreeOptions в JSON): include/exclude/sort.
func (a *App) LoadTree(root string, optsJSON string) (*FileNode, error) {
	info, err := os.Stat(root)
	if err != nil {
		return nil, fmt.Errorf("папка недоступна: %w", err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("это не папка: %s", root)
	}
	root = filepath.Clean(root)
	node := &FileNode{Name: filepath.Base(root), Path: "", IsDir: true}
	buildTree(node, root, parseTreeOptions(optsJSON))
	return node, nil
}

func buildTree(node *FileNode, dir string, opts *TreeOptions) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	sortMode := ""
	if opts != nil {
		sortMode = opts.Sort
	}
	for _, e := range entries {
		name := e.Name()
		rel := name
		if node.Path != "" {
			rel = node.Path + "/" + name
		}
		if e.IsDir() {
			if _, skip := skipDirs[lowerName(name)]; skip {
				continue
			}
			if opts != nil && matchAny(opts.Exclude, rel) {
				continue // папка отсекается вместе с поддеревом
			}
			child := &FileNode{Name: name, Path: rel, IsDir: true}
			buildTree(child, filepath.Join(dir, name), opts)
			if len(child.Children) > 0 {
				node.Children = append(node.Children, child)
			}
		} else if isMarkdown(name) {
			if opts != nil {
				if matchAny(opts.Exclude, rel) {
					continue
				}
				if len(opts.Include) > 0 && !matchAny(opts.Include, rel) {
					continue
				}
			}
			f := &FileNode{Name: name, Path: rel}
			if fi, err := e.Info(); err == nil {
				f.ModifiedAt = fi.ModTime().UnixMilli()
			}
			node.Children = append(node.Children, f)
		}
	}
	sortTree(node.Children, sortMode)
}

func sortTree(nodes []*FileNode, mode string) {
	sort.Slice(nodes, func(i, j int) bool {
		a, b := nodes[i], nodes[j]
		if a.IsDir != b.IsDir {
			return a.IsDir
		}
		switch mode {
		case "name-desc":
			return lowerName(a.Name) > lowerName(b.Name)
		case "modified":
			if a.ModifiedAt != b.ModifiedAt {
				return a.ModifiedAt > b.ModifiedAt
			}
			return lowerName(a.Name) < lowerName(b.Name)
		default:
			return lowerName(a.Name) < lowerName(b.Name)
		}
	})
}

func lowerName(s string) string {
	return strings.ToLower(s)
}
