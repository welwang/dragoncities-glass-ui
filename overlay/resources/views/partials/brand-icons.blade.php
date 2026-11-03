<script id="panel-brand" type="application/json">{!! json_encode($panelBrand, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE) !!}</script>
<link rel="apple-touch-icon" href="{{ $panelBrand['logo'] }}">
<link rel="icon" type="image/png" href="{{ $panelBrand['logo'] }}">
<link rel="shortcut icon" type="image/png" href="{{ $panelBrand['logo'] }}">
<link rel="manifest" href="/branding/manifest.json?v={{ substr(hash('sha256', json_encode($panelBrand)), 0, 12) }}">
<meta name="msapplication-config" content="/branding/browserconfig.xml?v={{ substr(hash('sha256', json_encode($panelBrand)), 0, 12) }}">
