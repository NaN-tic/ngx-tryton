import { Injectable, Inject } from '@angular/core';
import { Http, Headers } from '@angular/http';
import { DOCUMENT } from '@angular/platform-browser'
import { Observable } from 'rxjs/Observable';
import { environment } from '../../../environments/environment';
import { throwError } from 'rxjs';

@Injectable()
export class TrytonService {
  serverUrl: string;
  database: string;
  login: string;
  userId: number;
  sessionId: string;
  context: string;

  constructor(private http: Http,
              @Inject(DOCUMENT) private document: any) {
    this.serverUrl = sessionStorage.getItem('serverUrl');
    if (!this.serverUrl) {
      this.setServerUrl(window.location.origin);
    }
  }

  // TODO: trytonResponseInterceptor

  loadAllFromStorage() {
    this.database = sessionStorage.getItem('database');
    this.login = sessionStorage.getItem('login');
    this.userId = Number(sessionStorage.getItem('userId'));
    this.sessionId = sessionStorage.getItem('sessionId');
    this.context = sessionStorage.getItem('context');
  }

  setServerUrl(url) {
    this.serverUrl = url + (url.slice(-1) === '/' ? '' : '/');
    sessionStorage.setItem('serverUrl', this.serverUrl);
  }

  get_auth() {
    this.loadAllFromStorage();
    return btoa(this.login + ':' + this.userId + ':' + this.sessionId);
  }

  rpc(database: string, method: string, params: Array<any>, context: {} = null): Observable<any> {
    // Original tryton service rpc()
    // var _params = Fulfil.transformRequest(params);
    let headers = new Headers()
    headers.append('Content-Type', 'application/json')
    headers.append('Authorization','Session ' + this.get_auth());

    // copy object in a new imuptable object
    // const context = context ? context : JSON.parse(this.context);
    const new_context = Object.assign({}, context ? context : JSON.parse(this.context));
    // Concat list in a new immutable list
    const new_params = [...params || [], new_context];

    let options = {
      'method': method,
      'params': new_params,
    }
    if (method === 'common.db.logout') {
      options['id'] = 0;
      options['params'] = [];
    }

    return this.http.post(
      this.serverUrl + (database || '') + '/', JSON.stringify(options), {headers: headers})
        .map(res => {
          let new_res = res.json();
          if (!new_res) {
            return Observable.throw('Empty response');
          } else if (new_res['result']) {
            return new_res['result'];  // TODO: Fulfil.transformResponse
          } else if (new_res['error']) {
            return this._handleTrytonError(new_res['error']);
          }
          return new_res;
        })
        .catch(this._handleError);
  }

  private _handleError(error: Response | any) {
    // console.error(error._body || 'Server error');
    return throwError(error._body || 'Server error');
  }

  _handleTrytonError(error) {
    console.log("TrytonError:", error);
    let tryton_error;
    if (error instanceof Array) {
      switch (error[0]) {
        case "NotLogged":
          tryton_error = {
            'error': 'tryton:NotLogged',
            'messages': []
          };
          break;
        case "UserError":
          tryton_error = {
            'error': 'tryton:UserError',
            'messages': error[1]
          };
          break;
        case "UserWarning":
          tryton_error = {
            'error': 'tryton:UserWarning',
            'messages': error[1]
          };
          break;
        case "ConcurrencyException":
          tryton_error = {
            'error': 'tryton:ConcurrencyException',
            'messages': error[1],
          };
          break;
        default:
          tryton_error = {
            'error': 'tryton:ConcurrencyException',
            'messages': error,
          };
      }
    } else {
      tryton_error = {
        'error': 'tryton:ConcurrencyException',
        'messages': error,
      };
    }
    // TODO: raise an error that could be showed to user
    throw tryton_error;
  }
};
