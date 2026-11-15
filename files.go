package main

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"os"
	"strings"
	"unicode/utf8"
)

const maxFileBytes = 16 << 20 // 16 МБ

// FileContent — содержимое файла для фронтенда.
type FileContent struct {
	Path       string `json:"path"`
	Content    string `json:"content"`
	ModifiedAt int64  `json:"modifiedAt"`
}

// ReadFile читает текстовый файл проекта.
func (a *App) ReadFile(root, rel string) (*FileContent, error) {
	p := absPath(root, rel)
	fi, err := os.Stat(p)
	if err != nil {
		return nil, fmt.Errorf("файл не найден: %s", rel)
	}
	if fi.IsDir() {
		return nil, fmt.Errorf("это папка, а не файл: %s", rel)
	}
	if fi.Size() > maxFileBytes {
		return nil, fmt.Errorf("файл слишком большой (%d МБ)", fi.Size()>>20)
	}
	data, err := os.ReadFile(p)
	if err != nil {
		return nil, err
	}
	return &FileContent{
		Path:       rel,
		Content:    decodeText(data),
		ModifiedAt: fi.ModTime().UnixMilli(),
	}, nil
}

var imageMimes = map[string]string{
	".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
	".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp",
	".bmp": "image/bmp", ".ico": "image/x-icon", ".avif": "image/avif",
}

// ReadFileBase64 возвращает картинку из проекта как data-URI источник.
func (a *App) ReadFileBase64(root, rel string) (string, error) {
	p := absPath(root, rel)
	mime, ok := imageMimes[lowerExt(p)]
	if !ok {
		return "", fmt.Errorf("не изображение: %s", rel)
	}
	fi, err := os.Stat(p)
	if err != nil {
		return "", fmt.Errorf("файл не найден: %s", rel)
	}
	if fi.Size() > maxFileBytes {
		return "", fmt.Errorf("файл слишком большой")
	}
	data, err := os.ReadFile(p)
	if err != nil {
		return "", err
	}
	return mime + ";base64," + base64.StdEncoding.EncodeToString(data), nil
}

// decodeText превращает байты в строку: снимает BOM и чинит битый UTF-8.
func decodeText(data []byte) string {
	data = bytes.TrimPrefix(data, []byte{0xEF, 0xBB, 0xBF})
	if utf8.Valid(data) {
		return string(data)
	}
	return strings.ToValidUTF8(string(data), "\uFFFD")
}
