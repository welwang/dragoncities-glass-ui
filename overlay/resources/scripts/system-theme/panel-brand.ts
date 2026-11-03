interface PanelBrand {
    name: string;
    logo: string;
}

const data = document.getElementById('panel-brand');
export const panelBrand: PanelBrand = data
    ? JSON.parse(data.textContent!)
    : { name: 'DragonCities', logo: '/branding/dragoncities-logo.png?v=20261103-2' };
