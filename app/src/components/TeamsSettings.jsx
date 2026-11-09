import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Alert, Button, Field, controlClass } from './ui.jsx';

function microsoftLoginUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'login.microsoftonline.com';
  } catch {
    return false;
  }
}

function withCurrent(list, id, name) {
  if (!id) return list;
  if (list.some((item) => item.id === id)) return list;
  return [{ id, name: name || id }, ...list];
}

export function TeamsSettings({ notice }) {
  const [settings, setSettings] = useState(null);
  const [method, setMethod] = useState('webhook');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [teams, setTeams] = useState([]);
  const [channels, setChannels] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [message, setMessage] = useState(notice?.text || '');
  const [tone, setTone] = useState(notice?.tone || 'info');
  const [busy, setBusy] = useState('');

  function report(text, nextTone = 'info') {
    setTone(nextTone);
    setMessage(text);
  }

  function applySettings(data) {
    const graph = data.graph || {};
    setSettings(data);
    setMethod(data.method === 'graph' ? 'graph' : 'webhook');
    setTenantId(graph.tenantId || '');
    setClientId(graph.clientId || '');
    setClientSecret('');
    setTeamId(graph.teamId || '');
    setChannelId(graph.channelId || '');
    return graph;
  }

  useEffect(() => {
    let ignore = false;
    api('/settings/teams').then(async (data) => {
      if (ignore) return;
      const graph = applySettings(data);
      if (!graph.connected) return;
      try {
        const listed = await api('/settings/teams/graph/teams');
        if (ignore) return;
        setTeams(listed.teams || []);
        if (graph.teamId) {
          const channelList = await api(`/settings/teams/graph/channels/${graph.teamId}`);
          if (!ignore) setChannels(channelList.channels || []);
        }
      } catch (error) {
        if (!ignore) report(error.message, 'error');
      }
    }).catch((error) => {
      if (!ignore) report(error.message, 'error');
    });
    return () => {
      ignore = true;
    };
  }, []);

  async function chooseMethod(next) {
    const previous = method;
    setMethod(next);
    setBusy('method');
    try {
      const data = await api('/settings/teams/method', { method: 'PUT', body: { method: next } });
      applySettings(data);
      report(next === 'graph'
        ? 'New projects will post through Microsoft Graph.'
        : 'New projects will post through the webhook.');
    } catch (error) {
      setMethod(previous);
      report(error.message, 'error');
    } finally {
      setBusy('');
    }
  }

  async function saveWebhook(event) {
    event.preventDefault();
    setBusy('webhook');
    try {
      const data = await api('/settings/teams', { method: 'PUT', body: { webhookUrl } });
      applySettings(data);
      setWebhookUrl('');
      report(data.webhookConfigured ? 'Teams channel webhook saved.' : 'Teams webhook cleared.');
    } catch (error) {
      report(error.message, 'error');
    } finally {
      setBusy('');
    }
  }

  async function saveApp(event) {
    event.preventDefault();
    setBusy('app');
    try {
      const data = await api('/settings/teams/graph', {
        method: 'PUT',
        body: { tenantId, clientId, clientSecret },
      });
      const graph = applySettings(data);
      if (!graph.connected) {
        setTeams([]);
        setChannels([]);
      }
      report('Azure app saved.');
    } catch (error) {
      report(error.message, 'error');
    } finally {
      setBusy('');
    }
  }

  async function connect() {
    setBusy('connect');
    try {
      const data = await api('/settings/teams/graph/connect', { method: 'POST', body: {} });
      if (!microsoftLoginUrl(data.authorizeUrl)) {
        throw new Error('Microsoft did not return a sign-in link.');
      }
      window.location.assign(data.authorizeUrl);
    } catch (error) {
      report(error.message, 'error');
      setBusy('');
    }
  }

  async function disconnect() {
    setBusy('disconnect');
    try {
      const data = await api('/settings/teams/graph/disconnect', { method: 'POST', body: {} });
      applySettings(data);
      setTeams([]);
      setChannels([]);
      report('Microsoft account disconnected.');
    } catch (error) {
      report(error.message, 'error');
    } finally {
      setBusy('');
    }
  }

  async function chooseTeam(nextTeamId) {
    setTeamId(nextTeamId);
    setChannelId('');
    setChannels([]);
    if (!nextTeamId) return;
    setBusy('channels');
    try {
      const data = await api(`/settings/teams/graph/channels/${nextTeamId}`);
      setChannels(data.channels || []);
    } catch (error) {
      report(error.message, 'error');
    } finally {
      setBusy('');
    }
  }

  async function saveChannel(event) {
    event.preventDefault();
    setBusy('channel');
    try {
      const data = await api('/settings/teams/graph/target', {
        method: 'PUT',
        body: { teamId, channelId },
      });
      applySettings(data);
      report(`New projects will post to ${data.graph.channelName} in ${data.graph.teamName}.`);
    } catch (error) {
      report(error.message, 'error');
    } finally {
      setBusy('');
    }
  }

  async function copyRedirect() {
    const uri = settings?.graph?.redirectUri || '';
    try {
      await navigator.clipboard.writeText(uri);
      report('Redirect URI copied.');
    } catch {
      report('Select the redirect URI and copy it.', 'error');
    }
  }

  const graph = settings?.graph || {};
  const teamOptions = withCurrent(teams, graph.teamId, graph.teamName);
  const channelOptions = withCurrent(channels, teamId === graph.teamId ? graph.channelId : '', graph.channelName);

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <h2 className="font-display text-xl text-navy-900">Microsoft Teams</h2>
      <p className="mt-1 text-sm text-muted">
        When a project is added, the tracker posts a short note to a Teams channel. Choose a Workflows webhook, or sign in with Microsoft Graph and post as a member of the team.
      </p>

      {!settings ? <p className="mt-4 text-sm text-muted">Loading Teams settings…</p> : (
        <div className="mt-4 grid gap-6">
          <div role="radiogroup" aria-label="How new projects are announced" className="grid gap-2 sm:grid-cols-2">
            <MethodOption
              checked={method === 'webhook'}
              disabled={busy === 'method'}
              title="Workflows webhook"
              body="Paste a channel webhook. No Azure app."
              onSelect={() => chooseMethod('webhook')}
            />
            <MethodOption
              checked={method === 'graph'}
              disabled={busy === 'method'}
              title="Microsoft Graph"
              body="Post as a signed-in Microsoft 365 user."
              onSelect={() => chooseMethod('graph')}
            />
          </div>

          <p className="text-sm font-semibold text-navy-800">{statusLine(settings)}</p>

          <form onSubmit={saveWebhook} className="grid gap-3 border-t border-line pt-5">
            <h3 className="font-display text-lg text-navy-900">Workflows webhook</h3>
            <p className="text-sm text-muted">
              In the channel, create a workflow named “Post to a channel when a webhook request is received”, then paste its URL. The URL is stored in the database and is never shown again after you save.
            </p>
            <Field
              label="Webhook URL"
              hint={settings.webhookConfigured ? 'Paste a new URL to replace it, or leave blank and save to clear.' : 'Paste the https Workflows webhook URL.'}
            >
              <input
                className={controlClass}
                type="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://…"
                value={webhookUrl}
                onChange={(event) => setWebhookUrl(event.target.value)}
              />
            </Field>
            <div>
              <Button type="submit" disabled={busy === 'webhook'}>
                {busy === 'webhook' ? 'Saving…' : 'Save Teams webhook'}
              </Button>
            </div>
          </form>

          <form onSubmit={saveApp} className="grid gap-3 border-t border-line pt-5">
            <h3 className="font-display text-lg text-navy-900">Microsoft Graph</h3>
            <p className="text-sm text-muted">
              Register a single-tenant app in Microsoft Entra. Add the redirect URI below as a Web redirect, create a client secret, and grant delegated permission for User.Read, Team.ReadBasic.All, Channel.ReadBasic.All, and ChannelMessage.Send. An administrator may need to consent. The signed-in account must belong to the team.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[220px] flex-1">
                <Field label="Redirect URI" hint="This site’s address. Local and the public site each need their own URI in Azure.">
                  <input className={controlClass} readOnly value={graph.redirectUri || ''} onFocus={(event) => event.target.select()} />
                </Field>
              </div>
              <Button type="button" variant="secondary" onClick={copyRedirect}>Copy</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Directory (tenant) ID">
                <input className={controlClass} autoComplete="off" spellCheck={false} value={tenantId} onChange={(event) => setTenantId(event.target.value)} />
              </Field>
              <Field label="Application (client) ID">
                <input className={controlClass} autoComplete="off" spellCheck={false} value={clientId} onChange={(event) => setClientId(event.target.value)} />
              </Field>
            </div>
            <Field
              label="Client secret"
              hint={graph.secretConfigured ? 'Leave blank to keep the saved secret. Changing the tenant or client ID disconnects the Microsoft account.' : 'Paste the client secret value, not the secret ID.'}
            >
              <input
                className={controlClass}
                type="password"
                autoComplete="new-password"
                spellCheck={false}
                value={clientSecret}
                onChange={(event) => setClientSecret(event.target.value)}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy === 'app'}>{busy === 'app' ? 'Saving…' : 'Save Azure app'}</Button>
              {graph.connected ? (
                <Button type="button" variant="secondary" onClick={disconnect} disabled={busy === 'disconnect'}>
                  {busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect account'}
                </Button>
              ) : (
                <Button type="button" variant="secondary" onClick={connect} disabled={!graph.appConfigured || busy === 'connect'}>
                  {busy === 'connect' ? 'Opening Microsoft…' : 'Connect Microsoft account'}
                </Button>
              )}
            </div>
            {graph.connected ? (
              <p className="text-sm text-navy-800">Connected as {graph.account || 'a Microsoft account'}.</p>
            ) : null}
          </form>

          {graph.connected ? (
            <form onSubmit={saveChannel} className="grid gap-3 border-t border-line pt-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <h3 className="font-display text-lg text-navy-900">Channel</h3>
              </div>
              <Field label="Team">
                <select className={controlClass} value={teamId} onChange={(event) => chooseTeam(event.target.value)}>
                  <option value="">Choose a team</option>
                  {teamOptions.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </Field>
              <Field label="Channel">
                <select
                  className={controlClass}
                  value={channelId}
                  disabled={!teamId || busy === 'channels'}
                  onChange={(event) => setChannelId(event.target.value)}
                >
                  <option value="">{busy === 'channels' ? 'Loading channels…' : 'Choose a channel'}</option>
                  {channelOptions.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
                </select>
              </Field>
              <div className="md:col-span-2">
                <Button type="submit" disabled={busy === 'channel' || !teamId || !channelId}>
                  {busy === 'channel' ? 'Saving…' : 'Save channel'}
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      )}

      {message ? <div className="mt-4"><Alert tone={tone}>{message}</Alert></div> : null}
    </section>
  );
}

function MethodOption({ checked, disabled, title, body, onSelect }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 ${checked ? 'border-navy-800 bg-paper' : 'border-line'}`}>
      <input
        type="radio"
        name="teams-method"
        className="mt-1"
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
      />
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs font-normal text-muted">{body}</span>
      </span>
    </label>
  );
}

function statusLine(settings) {
  if (settings.method === 'graph') {
    if (settings.graph?.ready) {
      return `New projects post to ${settings.graph.channelName} in ${settings.graph.teamName}.`;
    }
    return 'Microsoft Graph is selected. New projects stay quiet until an account is connected and a channel is saved.';
  }
  return settings.webhookConfigured
    ? 'New projects post through the saved webhook.'
    : 'Workflows webhook is selected. No channel webhook yet.';
}
