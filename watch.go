package main

import (
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// StartWatch следит за деревом проекта и шлёт фронтенду событие «fs:changed»
// с данными {path, op}: op = write | create | remove.
func (a *App) StartWatch(root string) error {
	root = filepath.Clean(root)
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.watcher != nil && a.watchRoot == root {
		return nil
	}
	a.stopWatchLocked()
	w, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}
	_ = filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil || !d.IsDir() {
			return nil
		}
		if _, skip := skipDirs[lowerName(d.Name())]; skip && path != root {
			return filepath.SkipDir
		}
		_ = w.Add(path)
		return nil
	})
	a.watcher = w
	a.watchRoot = root
	a.watchStop = make(chan struct{})
	go a.watchLoop(w, a.watchStop, root)
	return nil
}

// StopWatch останавливает слежение.
func (a *App) StopWatch() {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.stopWatchLocked()
}

func (a *App) stopWatchLocked() {
	if a.watchStop != nil {
		close(a.watchStop)
		a.watchStop = nil
	}
	if a.watcher != nil {
		_ = a.watcher.Close()
		a.watcher = nil
	}
	a.watchRoot = ""
}

func (a *App) watchLoop(w *fsnotify.Watcher, stop chan struct{}, root string) {
	var dm sync.Mutex
	timers := map[string]*time.Timer{}
	schedule := func(op, abs string) {
		dm.Lock()
		defer dm.Unlock()
		key := op + "|" + abs
		if t := timers[key]; t != nil {
			t.Stop()
		}
		timers[key] = time.AfterFunc(200*time.Millisecond, func() {
			dm.Lock()
			delete(timers, key)
			dm.Unlock()
			a.emitChange(op, root, abs)
		})
	}
	for {
		select {
		case <-stop:
			return
		case ev, ok := <-w.Events:
			if !ok {
				return
			}
			var op string
			switch {
			case ev.Op&fsnotify.Write != 0:
				op = "write"
			case ev.Op&fsnotify.Create != 0:
				op = "create"
			case ev.Op&(fsnotify.Remove|fsnotify.Rename) != 0:
				op = "remove"
			default:
				continue
			}
			if op == "create" {
				if fi, err := os.Stat(ev.Name); err == nil && fi.IsDir() {
					_ = w.Add(ev.Name)
				}
			}
			schedule(op, ev.Name)
		case _, ok := <-w.Errors:
			if !ok {
				return
			}
		}
	}
}

func (a *App) emitChange(op, root, abs string) {
	a.searchMu.Lock()
	a.searchStale = true
	a.searchMu.Unlock()
	rel, err := filepath.Rel(root, abs)
	if err != nil {
		return
	}
	runtime.EventsEmit(a.ctx, "fs:changed", map[string]string{
		"path": filepath.ToSlash(rel),
		"op":   op,
	})
}
