const DISCOVERY_DOCS = ['https://sheets.googleapis.com/$discovery/rest?version=v4'];
export const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

type TokenListener = ((tokenInfo: any) => void) | null;

export class GoogleSheetsAPI {
  gapiLoaded: boolean;
  gisLoaded: boolean;
  tokenClient: any;
  accessToken: string | null;
  tokenExpiry: number | null;
  onToken: TokenListener;
  clientId?: string;
  apiKey?: string;

  constructor() {
    this.gapiLoaded = false;
    this.gisLoaded = false;
    this.tokenClient = null;
    this.accessToken = null;
    this.tokenExpiry = null;
    this.onToken = null;
  }

  setTokenListener(listener: TokenListener) {
    this.onToken = typeof listener === 'function' ? listener : null;
  }

  handleTokenResponse(response: any) {
    if (!response || response.error) {
      console.warn('Token request was not successful', response?.error);
      return false;
    }
    if (response.access_token) {
      this.accessToken = response.access_token;
      if (typeof gapi !== 'undefined' && gapi?.client?.setToken) {
        gapi.client.setToken({ access_token: response.access_token });
      }
      const expiresIn = Number(response.expires_in || response.expiresIn);
      this.tokenExpiry = Number.isFinite(expiresIn) ? Date.now() + expiresIn * 1000 : null;
      if (this.onToken) {
        this.onToken({
          access_token: response.access_token,
          expires_in: response.expires_in,
          expires_at: this.tokenExpiry,
          scope: response.scope,
        });
      }
      return true;
    }
    return false;
  }

  applySavedToken(session: any) {
    if (!session || !session.accessToken) return false;
    if (typeof gapi === 'undefined' || !gapi?.client?.setToken) return false;
    gapi.client.setToken({ access_token: session.accessToken });
    this.accessToken = session.accessToken;
    this.tokenExpiry = session.expiresAt || null;
    return true;
  }

  clearToken() {
    if (typeof gapi !== 'undefined' && gapi?.client?.setToken) {
      gapi.client.setToken(null);
    }
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async initialize(clientId: string, apiKey: string) {
    return new Promise<boolean>((resolve, reject) => {
      if (typeof gapi === 'undefined') {
        reject(new Error('Google API not loaded'));
        return;
      }

      gapi.load('client', async () => {
        try {
          await gapi.client.init({
            apiKey,
            discoveryDocs: DISCOVERY_DOCS,
          });
          this.gapiLoaded = true;
          this.clientId = clientId;
          this.apiKey = apiKey;

          if (typeof google !== 'undefined' && google.accounts) {
            this.tokenClient = google.accounts.oauth2.initTokenClient({
              client_id: clientId,
              scope: SCOPES,
              callback: (response: any) => {
                this.handleTokenResponse(response);
              },
            });
            this.gisLoaded = true;
          }

          resolve(true);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  requestAccessToken(options: { prompt?: string } = {}) {
    return new Promise<boolean>((resolve) => {
      if (this.tokenClient) {
        this.tokenClient.callback = (response: any) => {
          resolve(this.handleTokenResponse(response));
        };
        const requestOptions: { prompt?: string } = {};
        if (options.prompt !== undefined) {
          requestOptions.prompt = options.prompt;
        }
        this.tokenClient.requestAccessToken(requestOptions);
      } else {
        resolve(false);
      }
    });
  }

  async readData(spreadsheetId: string, range: string) {
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    return response.result.values || [];
  }

  async writeData(spreadsheetId: string, range: string, values: any[][]) {
    const response = await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      resource: { values },
    });
    return response.result;
  }

  async appendData(spreadsheetId: string, range: string, values: any[][]) {
    const response = await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values },
    });
    return response.result;
  }

  async deleteRow(spreadsheetId: string, sheetId: number, rowIndex: number) {
    const response = await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });
    return response.result;
  }
}

export const sheetsAPI = new GoogleSheetsAPI();
