package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const maxEditNameLen = 200

// WriteFile записывает текст в файл проекта (UTF-8), атомарно: tmp+rename.
func (a *App) WriteFile(root, rel, content string) error {
	if !isMarkdown(rel) {
		return fmt.Errorf("редактировать можно только .md файлы: %s", rel)
	}
	p := absPath(root, rel)
	fi, err := os.Stat(p)
	if err != nil {
		return fmt.Errorf("файл не найден: %s", rel)
	}
	if fi.IsDir() {
		return fmt.Errorf("это папка, а не файл: %s", rel)
	}
	tmp, err := os.CreateTemp(filepath.Dir(p), ".mdr-tmp-*")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	_, err = tmp.WriteString(content)
	if cerr := tmp.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		os.Remove(tmpName)
		return err
	}
	if err := os.Rename(tmpName, p); err != nil {
		os.Remove(tmpName)
		return err
	}
	return nil
}

// CreateFile создаёт новый .md файл с шаблоном заголовка.
func (a *App) CreateFile(root, rel string) error {
	if !isMarkdown(rel) {
		return fmt.Errorf("можно создавать только .md файлы: %s", rel)
	}
	p := absPath(root, rel)
	if _, err := os.Stat(p); err == nil {
		return fmt.Errorf("файл уже существует: %s", rel)
	}
	if len(filepath.Base(rel)) > maxEditNameLen {
		return fmt.Errorf("слишком длинное имя")
	}
	title := strings.TrimSuffix(filepath.Base(rel), filepath.Ext(rel))
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return err
	}
	tpl := "# " + title + "\n\n"
	return os.WriteFile(p, []byte(tpl), 0o644)
}

// CreateFolder создаёт папку внутри проекта.
func (a *App) CreateFolder(root, rel string) error {
	if err := validName(filepath.Base(rel)); err != nil {
		return err
	}
	return os.MkdirAll(absPath(root, rel), 0o755)
}

// RenameEntry переименовывает файл или папку (только последний элемент пути).
func (a *App) RenameEntry(root, rel, newName string) error {
	if err := validName(newName); err != nil {
		return err
	}
	if !isMarkdown(newName) && !isDirPath(root, rel) {
		return fmt.Errorf("файлы можно переименовывать только в .md: %s", newName)
	}
	p := absPath(root, rel)
	np := filepath.Join(filepath.Dir(p), newName)
	if _, err := os.Stat(np); err == nil {
		return fmt.Errorf("уже существует: %s", newName)
	}
	return os.Rename(p, np)
}

// DeleteEntry удаляет файл или папку (папка — рекурсивно). Подтверждение — на фронте.
func (a *App) DeleteEntry(root, rel string) error {
	if rel == "" {
		return fmt.Errorf("нельзя удалить корень проекта")
	}
	p := absPath(root, rel)
	if fi, err := os.Stat(p); err != nil {
		return fmt.Errorf("не найдено: %s", rel)
	} else if fi.IsDir() {
		return os.RemoveAll(p)
	}
	return os.Remove(p)
}

func isDirPath(root, rel string) bool {
	fi, err := os.Stat(absPath(root, rel))
	return err == nil && fi.IsDir()
}

// validName проверяет имя файла/папки: без разделителей и служебных значений.
func validName(name string) error {
	if name == "" || name == "." || name == ".." || len(name) > maxEditNameLen {
		return fmt.Errorf("недопустимое имя: %q", name)
	}
	if strings.ContainsAny(name, `/\:`) || strings.ContainsAny(name, "*?\"<>|") {
		return fmt.Errorf("недопустимые символы в имени: %q", name)
	}
	return nil
}
