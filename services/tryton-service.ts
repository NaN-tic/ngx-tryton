import { Injectable, Inject } from '@angular/core';
import { Http, Headers } from '@angular/http';
import { DOCUMENT } from '@angular/platform-browser'
import {Observable} from 'rxjs/Observable';
import { environment } from '../../../environments/environment';
import 'rxjs/Rx';


@Injectable()
export class TrytonService {
  serverUrl: string;
  database: string;
  login: string;
  userId: number;
  sessionId: string;

  constructor(private http: Http, @Inject(DOCUMENT) private document: any,) {
    this.serverUrl = sessionStorage.getItem('serverUrl');
    if (!this.serverUrl) {
      this.setServerUrl(environment.url_server);
    }
  }

  // TODO: trytonResponseInterceptor

  loadAllFromStorage() {
    this.database = sessionStorage.getItem('database');
    this.login = sessionStorage.getItem('login');
    this.userId = Number(sessionStorage.getItem('userId'));
    this.sessionId = sessionStorage.getItem('sessionId');
    // this.context = sessionStorage.getItem('context');
  }

  setServerUrl(url) {
    this.serverUrl = url + (url.slice(-1) === '/' ? '' : '/');
    sessionStorage.setItem('serverUrl', this.serverUrl);
  }

  get_auth() {
    this.loadAllFromStorage();
    return btoa(this.login + ':' + this.userId + ':' + this.sessionId);
  }

  rpc(database: string, method: string, params: Array<any>): Observable<any> {
    // Original tryton service rpc()
    // var _params = Fulfil.transformRequest(params);
    let _params = params;
    let headers = new Headers()
    headers.append('Content-Type', 'application/json')
    headers.append('Authorization','Session ' + this.get_auth());
    return this.http.post(
      this.serverUrl + (database || '') + '/',
      JSON.stringify({
        'method': method,
        'params': _params || [],
      }),{
          headers: headers
      })
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

  private _handleError(error) {
    // console.error(error);
    return Observable.throw(error || 'Server error');
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
