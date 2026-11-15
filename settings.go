package main

import (
	"encoding/json"
	"os"
	"path/filepath"
)

func settingsPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "md-reader", "settings.json"), nil
}

// GetSettings возвращает сохранённые настройки (JSON-строка или "{}").
func (a *App) GetSettings() (string, error) {
	p, err := settingsPath()
	if err != nil {
		return "{}", nil
	}
	data, err := os.ReadFile(p)
	if err != nil {
		return "{}", nil
	}
	return string(data), nil
}

// SaveSettings сохраняет настройки, присланные фронтендом (JSON-строка).
func (a *App) SaveSettings(raw string) error {
	if raw == "" {
		return nil
	}
	var v map[string]any
	if err := json.Unmarshal([]byte(raw), &v); err != nil {
		return err
	}
	p, err := settingsPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return err
	}
	return os.WriteFile(p, []byte(raw), 0o644)
}
