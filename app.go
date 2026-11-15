package main

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	"github.com/fsnotify/fsnotify"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App — основная структура приложения.
type App struct {
	ctx context.Context

	mu        sync.Mutex
	watcher   *fsnotify.Watcher
	watchRoot string
	watchStop chan struct{}

	searchMu    sync.Mutex
	searchRoot  string
	searchIdx   map[string][]string
	searchStale bool

	startupFile string
}

func NewApp(startupFile string) *App {
	return &App{startupFile: startupFile}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) shutdown(_ context.Context) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.stopWatchLocked()
}

// ChooseFolder открывает системный диалог выбора папки.
func (a *App) ChooseFolder(title string) (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{Title: title})
}

// TakeStartupFile возвращает файл, переданный в аргументах запуска (одноразово).
// Возвращает JSON {"root": "...", "rel": "..."} или пустую строку.
func (a *App) TakeStartupFile() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.startupFile == "" {
		return ""
	}
	abs := a.startupFile
	a.startupFile = ""
	root := filepath.Dir(abs)
	rel, err := filepath.Rel(root, abs)
	if err != nil {
		return ""
	}
	b, _ := json.Marshal(map[string]string{
		"root": root,
		"rel":  filepath.ToSlash(rel),
	})
	return string(b)
}

// OpenExternal открывает ссылку в системном браузере.
func (a *App) OpenExternal(url string) {
	if url == "" {
		return
	}
	runtime.BrowserOpenURL(a.ctx, url)
}

// SetWindowTitle меняет заголовок окна.
func (a *App) SetWindowTitle(title string) {
	runtime.WindowSetTitle(a.ctx, title)
}

// emitOpenRequest шлёт фронтенду запрос на открытие файла/папки.
func (a *App) emitOpenRequest(abs string) {
	root := filepath.Dir(abs)
	rel, err := filepath.Rel(root, abs)
	if err != nil {
		return
	}
	runtime.EventsEmit(a.ctx, "open-requested", map[string]string{
		"root": root,
		"rel":  filepath.ToSlash(rel),
	})
}

// onSecondInstance обрабатывает повторный запуск exe: открывает файл в текущем окне.
func (a *App) onSecondInstance(data options.SecondInstanceData) {
	for _, arg := range data.Args {
		if fi, err := os.Stat(arg); err == nil && !fi.IsDir() && isMarkdown(arg) {
			if abs, err := filepath.Abs(arg); err == nil {
				a.emitOpenRequest(abs)
				return
			}
		}
	}
}

// absPath превращает относительный путь (с «/») в абсолютный,
// не позволяя выйти за пределы root.
func absPath(root, rel string) string {
	clean := filepath.Clean("/" + filepath.ToSlash(rel))
	return filepath.Join(root, filepath.FromSlash(clean))
}

func isMarkdown(name string) bool {
	ext := lowerExt(name)
	return ext == ".md" || ext == ".markdown"
}

// lowerExt возвращает расширение в нижнем регистре (без точки не бывает — с точкой).
func lowerExt(name string) string {
	for i := len(name) - 1; i >= 0; i-- {
		if name[i] == '.' {
			return toLowerASCII(name[i:])
		}
		if name[i] == '/' || name[i] == '\\' {
			return ""
		}
	}
	return ""
}

func toLowerASCII(s string) string {
	b := []byte(s)
	for i := range b {
		if b[i] >= 'A' && b[i] <= 'Z' {
			b[i] += 32
		}
	}
	return string(b)
}
