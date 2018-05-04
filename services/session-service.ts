import {Injectable} from '@angular/core';
import {Observable} from 'rxjs/Observable';
import 'rxjs/Rx';

import {TrytonService} from './tryton-service';

@Injectable()
export class SessionService {
  database: string;
  login: string;
  userId: number;
  sessionId: string;
  password: string;
  context: {};

  constructor(private trytonService: TrytonService) {
    (this.isLoggedIn())? this.loadAllFromStorage() : false
  }

  loadAllFromStorage() {
    this.database = sessionStorage.getItem('database');
    this.login = sessionStorage.getItem('login');
    this.userId = Number(sessionStorage.getItem('userId'));
    this.sessionId = sessionStorage.getItem('sessionId');
    this.context = sessionStorage.getItem('context');
  }

  setSession(database: string, login: string, userId: number, sessionId: string) {
    // TODO: save it in shareable way to be used
    sessionStorage.setItem('database', database || null);
    sessionStorage.setItem('login', login || null);
    sessionStorage.setItem('userId', userId.toString() || null);
    sessionStorage.setItem('sessionId', sessionId || null);
    this.loadAllFromStorage();
  }

  clearSession() {
    sessionStorage.clear();
  }

  setDatabase(database: string) {
    sessionStorage.setItem('database', database || null);
    this.database = database;
  }

  setDefaultContext(context: {}) {
    sessionStorage.setItem('context', context.toString());
    this.loadAllFromStorage();
  }

  rpc(method: string, params: Array<any>, context: {} = null): Observable<any> {
    const new_context = Object.assign({}, this.context || {}, context || {});
    // Concat list in a new immutable list
    const new_params = [
      this.userId,
      this.sessionId,
      ...params || [],
      new_context
    ];
    return this.trytonService.rpc(this.database, method, new_params);
  }

  doLogin(database: string, username: string, password: string, getPreferences: boolean = false): Observable<{ userId: string, sessionId: string }> {
    let urlRegex = /^https?:\/\//i;
    let loginObservable;
    // Make sure URL has http or https in it.
    if (urlRegex.test(this.trytonService.serverUrl)
          || this.trytonService.serverUrl === '/') {
      loginObservable = this._tryLogin(database, username, password);
    } else {
      // If URL doesn't have protocol, try https first then http.
      this.trytonService.setServerUrl('https://' + this.trytonService.serverUrl);
      loginObservable = this._tryLogin(database, username, password)
      .retryWhen(errors => {
            return errors.do(function(e) {
              let serverUrl = this.trytonService.serverUrl;
              if (serverUrl.startsWith('https')) {
                  this.trytonService.setServerUrl(serverUrl.replace(/^https/i, 'http'));
              } else {
                  throw e;
          }
          });
      });
    }

    return loginObservable.do(result => {
      // Get the user preferences if user has asked for it.
      if (getPreferences) {
        this.rpc('model.res.user.get_preferences', [true], null)
          .subscribe(preferences => {
            this.setDefaultContext(preferences);
          });
      }
    });
  }

  private _tryLogin(database: string, username: string, password: string) {
    return this.trytonService.rpc(database, 'common.login', [username, password])
        .map(response => {
            if (response && response instanceof Array && response.length == 2) {
                return {
                    'userId': String(response[0]),
                    'sessionId': String(response[1]),
                }
            } else {
                return Observable.throw(
                    'Unexpected returned data for common.login method');
            }
        })
        .do(result => {
            this.setSession(database, username, result['userId'], result['sessionId']);
        });
  }

  doLogout() {
    let observable = this.trytonService.rpc('common.db.logout', null, null);
    this.clearSession();
    return observable;
  }

  isLoggedIn() {
    return !!this.sessionId;
  }

  isLoggedInPermissions() {
    return this.userId;
  }
}
