import 'models.dart';
import 'profile_repository.dart';

class MockProfileRepository implements ProfileRepository {
  @override
  Future<UserProfile> getProfile() async {
    await Future.delayed(const Duration(milliseconds: 400));
    return const UserProfile(
      id: 'rep-1',
      displayName: 'Rafael Melo',
      initials: 'RM',
      role: 'Representante Comercial',
      region: 'São Paulo · Zona Oeste',
      email: 'rafael.melo@atlasmed.com',
      phone: '+55 11 98412-5520',
      since: 'Desde março de 2024',
      avatarHue: 220,
    );
  }

  @override
  Future<TerritoryStats> getTerritoryStats() async {
    await Future.delayed(const Duration(milliseconds: 300));
    return const TerritoryStats(
      clinics: 127,
      doctors: 48,
      coveragePct: 42,
      visitedThisWeek: 53,
    );
  }

  @override
  Future<List<QuickSummaryItem>> getQuickSummary() async {
    await Future.delayed(const Duration(milliseconds: 200));
    return const [
      QuickSummaryItem(value: '18', label: 'Visitas', sub: 'esta semana', color: 0xFF0a2f7f),
      QuickSummaryItem(value: '7', label: 'Follow-ups', sub: 'pendentes', color: 0xFFc6861b),
      QuickSummaryItem(value: '34%', label: 'Conversão', sub: 'este mês', color: 0xFF16a373),
    ];
  }

  @override
  Future<List<PreferenceItem>> getPreferences() async {
    await Future.delayed(const Duration(milliseconds: 200));
    return const [
      PreferenceItem(label: 'Alertas de follow-up', sub: 'Lembretes por proximidade e data', kind: 'toggle', value: true),
      PreferenceItem(label: 'Oportunidades próximas', sub: 'Avisar quando estiver perto de clínicas sugeridas', kind: 'toggle', value: true),
      PreferenceItem(label: 'Horário de trabalho', sub: 'Seg a Sex · 08:00 – 18:00', kind: 'chevron'),
      PreferenceItem(label: 'Download só em Wi-Fi', sub: 'Apresentações grandes aguardam Wi-Fi', kind: 'toggle', value: true),
      PreferenceItem(label: 'Idioma', sub: 'Português (Brasil)', kind: 'chevron'),
    ];
  }

  @override
  Future<List<RecentActivity>> getRecentActivity() async {
    await Future.delayed(const Duration(milliseconds: 200));
    return const [
      RecentActivity(kind: 'visit', title: 'Visita registrada', detail: 'Clínica Santa Mônica', when: 'há 2 h'),
      RecentActivity(kind: 'followup', title: 'Follow-up concluído', detail: 'Dr. Paulo Cardoso', when: 'ontem'),
      RecentActivity(kind: 'order', title: 'Pedido enviado', detail: 'PED-2041 · Santa Mônica', when: 'ontem'),
      RecentActivity(kind: 'download', title: 'Apresentação baixada', detail: 'Portfólio de Produtos Q2', when: 'ter, 21 abr'),
    ];
  }

  @override
  Future<List<SupportItem>> getSupportItems() async {
    await Future.delayed(const Duration(milliseconds: 100));
    return const [
      SupportItem(label: 'Central de ajuda', sub: 'Tutoriais, perguntas frequentes', kind: 'help'),
      SupportItem(label: 'Falar com o suporte', sub: 'Resposta em até 4 h úteis', kind: 'chat'),
      SupportItem(label: 'Termos e privacidade', kind: 'legal'),
    ];
  }

  @override
  Future<void> logout() async {
    await Future.delayed(const Duration(milliseconds: 300));
  }
}
