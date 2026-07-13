<script lang="ts">
  import Notes from '@lucide/svelte/icons/notebook-pen';
  import ChartBar from '@lucide/svelte/icons/bar-chart-3';
  import Video from '@lucide/svelte/icons/video';
  import MessageCircle from '@lucide/svelte/icons/message-circle';
  import ChartDots from '@lucide/svelte/icons/pie-chart';
  import MailShare from '@lucide/svelte/icons/forward';

  interface Props {
    navigate: (path: string) => void;
    onUnavailable?: (label: string) => void;
  }
  let { navigate, onUnavailable = () => {} }: Props = $props();

  const services = [
    { icon: Notes, title: 'Prise de notes', desc: "Prendre des notes en réunion et diffuser les comptes rendus.", path: null, accent: 'blue' },
    { icon: ChartBar, title: 'Mes statistiques', desc: "Suivre l'usage et l'activité de ma messagerie.", path: '/mailbox/settings', accent: 'green' },
    { icon: Video, title: 'Visioconférence', desc: 'Organiser et rejoindre mes réunions.', path: null, accent: 'purple' },
    { icon: MessageCircle, title: 'Tchap', desc: 'Échanger avec mes groupes de travail.', path: null, accent: 'orange' },
    { icon: ChartDots, title: 'Sondage', desc: "Suivre mes sondages d'organisation.", path: null, accent: 'teal' },
    { icon: MailShare, title: 'Messagerie partagée', desc: "Vue d'ensemble de mes messageries partagées.", path: '/mailbox/settings#accounts', accent: 'red' },
  ];

  function open(service: (typeof services)[number]) {
    if (service.path) navigate(service.path);
    else onUnavailable(service.title);
  }
</script>

<div class="fe-office">
  <div class="fe-office-chip">Espace de travail</div>
  <h1>Mon bureau numérique</h1>
  <p class="fe-office-sub">
    Retrouvez vos services essentiels dans un espace unifié et sécurisé.
  </p>
  <div class="fe-office-grid">
    {#each services as s}
      <button type="button" class="fe-office-card fe-accent-{s.accent}" onclick={() => open(s)}>
        <span class="fe-office-icon"><s.icon size={20} /></span>
        <h3>{s.title}</h3>
        <p>{s.desc}</p>
      </button>
    {/each}
  </div>
</div>