import 'dart:convert';

import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/payer_catalog_mock.dart';

/// DTO from `GET/PUT /facilities/:id/healthcare-provider-shares`.
class FacilityPayerShareApi {
  const FacilityPayerShareApi({
    required this.id,
    required this.facilityId,
    required this.healthcareProviderId,
    required this.sharePercent,
    required this.providerName,
  });

  factory FacilityPayerShareApi.fromMap(Map<String, dynamic> map) {
    final provider =
        (map['healthcareProvider'] as Map?)?.cast<String, dynamic>() ??
        const {};
    return FacilityPayerShareApi(
      id: readString(map['id']),
      facilityId: readString(map['facilityId']),
      healthcareProviderId: readString(map['healthcareProviderId']),
      sharePercent: readNullableDouble(map['sharePercent']) ?? 0,
      providerName: readString(provider['name']),
    );
  }

  final String id;
  final String facilityId;
  final String healthcareProviderId;
  final double sharePercent;
  final String providerName;

  /// [PayerShare.id] is the healthcare provider id so the editor can match
  /// catalog entries when adding/removing rows.
  PayerShare toDomain() {
    return PayerShare(
      id: healthcareProviderId,
      name: providerName.isEmpty ? healthcareProviderId : providerName,
      sharePercent: sharePercent,
    );
  }
}

class FacilityPayerSharesResponse {
  const FacilityPayerSharesResponse({required this.items});

  factory FacilityPayerSharesResponse.fromJson(String json) {
    final decoded = jsonDecode(json) as Map<String, dynamic>;
    return FacilityPayerSharesResponse.fromMap(decoded);
  }

  factory FacilityPayerSharesResponse.fromMap(Map<String, dynamic> map) {
    return FacilityPayerSharesResponse(
      items: readObjectList(
        map['data'],
      ).map(FacilityPayerShareApi.fromMap).toList(growable: false),
    );
  }

  final List<FacilityPayerShareApi> items;

  List<PayerShare> toDomain() =>
      items.map((item) => item.toDomain()).toList(growable: false);
}

/// DTO from `GET /healthcare-providers`.
class HealthcareProviderApi {
  const HealthcareProviderApi({
    required this.id,
    required this.name,
    required this.type,
    required this.isActive,
  });

  factory HealthcareProviderApi.fromMap(Map<String, dynamic> map) {
    return HealthcareProviderApi(
      id: readString(map['id']),
      name: readString(map['name']),
      type: readString(map['type']),
      isActive: map['isActive'] != false,
    );
  }

  final String id;
  final String name;
  final String type;
  final bool isActive;

  PayerCatalogEntry toCatalogEntry() => PayerCatalogEntry(id: id, name: name);
}

class PaginatedHealthcareProviders {
  const PaginatedHealthcareProviders({required this.items});

  factory PaginatedHealthcareProviders.fromJson(String json) {
    final decoded = jsonDecode(json) as Map<String, dynamic>;
    return PaginatedHealthcareProviders.fromMap(decoded);
  }

  factory PaginatedHealthcareProviders.fromMap(Map<String, dynamic> map) {
    return PaginatedHealthcareProviders(
      items: readObjectList(
        map['data'],
      ).map(HealthcareProviderApi.fromMap).toList(growable: false),
    );
  }

  final List<HealthcareProviderApi> items;
}
