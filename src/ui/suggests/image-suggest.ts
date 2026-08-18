import { App, AbstractInputSuggest } from "obsidian";

export class ImagePathSuggest extends AbstractInputSuggest<string> {
  private inputEl: HTMLInputElement;

  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
    this.inputEl = inputEl;
  }

  protected getSuggestions(query: string): string[] {
    const files = this.app.vault.getFiles();
    const extensions = ["png", "jpg", "jpeg", "gif", "svg", "webp"];
    const lowerQuery = query.toLowerCase();

    return files
      .filter((file) => {
        const ext = file.extension.toLowerCase();
        const matchesExtension = extensions.includes(ext);
        const matchesQuery = file.path.toLowerCase().contains(lowerQuery);
        return matchesExtension && matchesQuery;
      })
      .map((file) => file.path);
  }

  renderSuggestion(value: string, el: HTMLElement): void {
    el.setText(value);
  }

  selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
    this.setValue(value);
    this.inputEl.dispatchEvent(new Event("input"));
    this.close();
  }
}
