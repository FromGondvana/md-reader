package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// ExportHTML сохраняет отрендеренный фронтендом документ в .html
// (диалог сохранения) и открывает его в браузере. PDF — средствами
// браузера: «Печать → Сохранить как PDF».
func (a *App) ExportHTML(fileName, html string) (string, error) {
	if strings.TrimSpace(html) == "" {
		return "", fmt.Errorf("нечего экспортировать: документ пуст")
	}
	if filepath.Ext(fileName) != ".html" {
		fileName += ".html"
	}
	p, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Экспорт документа",
		DefaultFilename: fileName,
		Filters: []runtime.FileFilter{
			{DisplayName: "HTML (*.html)", Pattern: "*.html"},
		},
	})
	if err != nil {
		return "", err
	}
	if p == "" {
		return "", nil // отмена
	}
	if err := os.WriteFile(p, []byte(html), 0o644); err != nil {
		return "", err
	}
	// открываем в системном браузере (file:// URL)
	url := "file:///" + strings.ReplaceAll(filepath.ToSlash(p), " ", "%20")
	runtime.BrowserOpenURL(a.ctx, url)
	return p, nil
}
