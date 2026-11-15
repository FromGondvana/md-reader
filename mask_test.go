package main

import "testing"

func TestMatchGlob(t *testing.T) {
	cases := []struct {
		pattern string
		path    string
		want    bool
	}{
		// без слэша — имя на любой глубине
		{"drafts", "drafts", true},
		{"drafts", "a/b/drafts", true},
		{"drafts", "drafts2", false},
		{"drafts", "a/drafts/c/заметка.md", false}, // имя файла не drafts
		{"*.tmp.md", "a/b/note.tmp.md", true},
		{"*.tmp.md", "a/b/note.md", false},
		{"README*", "README.md", true},

		// со слэшем — путь от корня
		{"docs/**", "docs/a/b.md", true},
		{"docs/**", "docs", true},
		{"docs/**", "docsx/a.md", false},
		{"docs/*", "docs/a.md", true},
		{"docs/*", "docs/a/b.md", false},
		{"проект/*/заметки.md", "проект/2024/заметки.md", true},
		{"проект/*/заметки.md", "проект/2024/другое.md", false},
		{"a/**/c.md", "a/b/c.md", true},
		{"a/**/c.md", "a/c.md", true},
		{"a/**/c.md", "a/b/d/c.md", true},
		{"/docs/**", "docs/a.md", true}, // слэши по краям обрезаются

		// прочее
		{"", "anything", false},
		{"**", "a/b/c.md", true},
		{"**", "a", true},
		{"?ode.md", "code.md", true},
		{"?ode.md", "xcode.md", false},
	}
	for _, c := range cases {
		if got := matchGlob(c.pattern, c.path); got != c.want {
			t.Errorf("matchGlob(%q, %q) = %v, want %v", c.pattern, c.path, got, c.want)
		}
	}
}

func TestMatchAny(t *testing.T) {
	rules := []string{"docs/**", " !drafts ", ""}
	if !matchAny(rules, "docs/x.md") {
		t.Error("docs/x.md должен совпасть")
	}
	if matchAny(rules, "other/x.md") {
		t.Error("other/x.md не должен совпасть")
	}
	// пустые правила игнорируются, «!» не создаёт ложных совпадений
	if matchAny([]string{""}, "anything") {
		t.Error("пустое правило не должно совпадать")
	}
}

func TestParseTreeOptions(t *testing.T) {
	if parseTreeOptions("") != nil {
		t.Error("пустая строка → nil")
	}
	if parseTreeOptions("мусор") != nil {
		t.Error("битый JSON → nil")
	}
	if parseTreeOptions("{}") != nil {
		t.Error("пустые опции → nil")
	}
	o := parseTreeOptions(`{"exclude":["drafts"],"sort":"modified"}`)
	if o == nil || len(o.Exclude) != 1 || o.Sort != "modified" {
		t.Errorf("опции разобраны неверно: %+v", o)
	}
}
