(function(scope){
  scope.VORTEK_CONTACT={
    link:(phone,message)=>{
      if(!/^\d{10,15}$/.test(phone)) throw new Error('Número de contato inválido.');
      return 'https://wa.me/'+phone+'?text='+encodeURIComponent(message);
    },
    quote:(values,favorites=[])=>{
      const name=String(values.name || '').trim(), company=String(values.company || '').trim(), service=String(values.service || '').trim(), message=String(values.message || '').trim();
      if(!name || !company || !service || message.length<10) throw new Error('Preencha nome, empresa, serviço e um resumo com pelo menos 10 caracteres.');
      if(name.length>100 || company.length>150 || service.length>100 || message.length>1500) throw new Error('Reduza o tamanho dos campos para preparar sua mensagem.');
      return `Olá, Vortek! Gostaria de solicitar um orçamento.\n\nNome: ${name}\nEmpresa: ${company}\nServiço: ${service}\n\nSobre o projeto:\n${message}${favorites.length?'\n\nDemonstrações favoritas: '+favorites.join(', '):''}`;
    }
  };
})(window);
