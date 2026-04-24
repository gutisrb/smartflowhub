export interface ObsidianNote {
  path: string;
  content: string;
}

export class ObsidianClient {
  private apiKey: string;
  private port: string;
  private host: string;

  constructor(apiKey: string, port: string = '27124', host: string = '127.0.0.1') {
    this.apiKey = apiKey;
    this.port = port;
    this.host = host;
  }

  private get baseUrl() {
    return `http://${this.host}:${this.port}`;
  }

  async searchNotes(query: string): Promise<string[]> {
    // Note: The Local REST API search implementation varies. 
    // Usually it's via the /search endpoint if the plugin supports it, 
    // or we list files and filter.
    try {
      const response = await fetch(`${this.baseUrl}/search?query=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        }
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.map((n: any) => n.path);
    } catch (e) {
      console.error('Obsidian Search Error:', e);
      return [];
    }
  }

  async getNote(path: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/vault/${path}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'text/markdown'
        }
      });
      if (!response.ok) return null;
      return await response.text();
    } catch (e) {
      console.error('Obsidian Read Error:', e);
      return null;
    }
  }
  
  async listAllNotes(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/vault/`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        }
      });
      if (!response.ok) return [];
      const data = await response.json();
      // data is { files: [ 'path1.md', 'path2.md' ] }
      return data.files || [];
    } catch (e) {
      return [];
    }
  }
}
