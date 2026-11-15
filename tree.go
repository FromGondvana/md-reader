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
	Name     string      `json:"name"`
	Path     string      `json:"path"` // относительный, с «/»
	IsDir    bool        `json:"isDir"`
	Children []*FileNode `json:"children,omitempty"`
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
func (a *App) LoadTree(root string) (*FileNode, error) {
	info, err := os.Stat(root)
	if err != nil {
		return nil, fmt.Errorf("папка недоступна: %w", err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("это не папка: %s", root)
	}
	root = filepath.Clean(root)
	node := &FileNode{Name: filepath.Base(root), Path: "", IsDir: true}
	buildTree(node, root)
	return node, nil
}

func buildTree(node *FileNode, dir string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
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
			child := &FileNode{Name: name, Path: rel, IsDir: true}
			buildTree(child, filepath.Join(dir, name))
			if len(child.Children) > 0 {
				node.Children = append(node.Children, child)
			}
		} else if isMarkdown(name) {
			node.Children = append(node.Children, &FileNode{Name: name, Path: rel})
		}
	}
	sortTree(node.Children)
}

func sortTree(nodes []*FileNode) {
	sort.Slice(nodes, func(i, j int) bool {
		if nodes[i].IsDir != nodes[j].IsDir {
			return nodes[i].IsDir
		}
		return lowerName(nodes[i].Name) < lowerName(nodes[j].Name)
	})
}

func lowerName(s string) string {
	return strings.ToLower(s)
}
