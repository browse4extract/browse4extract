import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { ScrapingTemplate } from '../types/types';

export class TemplateManager {
  private templatesPath: string;

  constructor() {
    // Use Electron's userData folder to store templates
    const userDataPath = app.getPath('userData');
    this.templatesPath = path.join(userDataPath, 'scraping-templates.json');

    // Create file if it doesn't exist
    if (!fs.existsSync(this.templatesPath)) {
      this.saveTemplates([]);
    }
  }

  private loadTemplates(): ScrapingTemplate[] {
    try {
      const data = fs.readFileSync(this.templatesPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading templates:', error);
      return [];
    }
  }

  private saveTemplates(templates: ScrapingTemplate[]): void {
    try {
      fs.writeFileSync(this.templatesPath, JSON.stringify(templates, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error saving templates:', error);
      throw error;
    }
  }

  getAllTemplates(): ScrapingTemplate[] {
    return this.loadTemplates();
  }

  saveTemplate(template: Omit<ScrapingTemplate, 'id' | 'createdAt' | 'updatedAt'>): ScrapingTemplate {
    const templates = this.loadTemplates();

    const newTemplate: ScrapingTemplate = {
      ...template,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    templates.push(newTemplate);
    this.saveTemplates(templates);

    return newTemplate;
  }

  updateTemplate(id: string, updates: Partial<ScrapingTemplate>): ScrapingTemplate {
    const templates = this.loadTemplates();
    const index = templates.findIndex(t => t.id === id);

    if (index === -1) {
      throw new Error(`Template with id ${id} not found`);
    }

    templates[index] = {
      ...templates[index],
      ...updates,
      id: templates[index].id, // Preserve original ID
      createdAt: templates[index].createdAt, // Preserve creation date
      updatedAt: new Date().toISOString()
    };

    this.saveTemplates(templates);
    return templates[index];
  }

  deleteTemplate(id: string): void {
    const templates = this.loadTemplates();
    const filteredTemplates = templates.filter(t => t.id !== id);

    if (filteredTemplates.length === templates.length) {
      throw new Error(`Template with id ${id} not found`);
    }

    this.saveTemplates(filteredTemplates);
  }

  getTemplateById(id: string): ScrapingTemplate | undefined {
    const templates = this.loadTemplates();
    return templates.find(t => t.id === id);
  }
}
