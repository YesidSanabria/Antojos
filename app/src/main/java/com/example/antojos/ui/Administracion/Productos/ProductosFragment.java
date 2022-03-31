package com.example.antojos.ui.Administracion.Productos;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.ViewModelProvider;
import androidx.navigation.Navigation;

import com.example.antojos.MainActivity;
import com.example.antojos.MainActivity2;
import com.example.antojos.R;
import com.example.antojos.databinding.FragmentProductosBinding;

public class ProductosFragment extends Fragment {

    View vista;
    Button AgregarProducto;
    Button EditarProducto;
    Button EliminarProducto;
    
    public ProductosFragment(){

    }

    private FragmentProductosBinding binding;

    public View onCreateView(@NonNull LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        /*ProductosViewModel productosViewModel = new ViewModelProvider(this).get(ProductosViewModel.class);

        binding = FragmentProductosBinding.inflate(inflater, container, false);
        View root = binding.getRoot();

        final TextView textView = binding.textGallery;
        productosViewModel.getText().observe(getViewLifecycleOwner(), textView::setText);
        return root;*/

        /*vista = inflater.inflate(R.layout.fragment_Productos,container,false);
        AgregarProducto = (Button) vista.findViewById(R.id.btnAgregarProducto);

        AgregarProducto.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                Intent agregarProducto = new Intent(ProductosFragment.this, AgregarProducto.f);
                startActivity(agregarProducto);
            }
        });
        return vista;*/
        return inflater.inflate(R.layout.fragment_Productos,container,false);

    }

   /* @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        Button AgregarProducto = view.findViewById(R.id.btnAgregarProducto);
        Button EditarProducto = view.findViewById(R.id.btnEditarProducto);
        Button EliminarProducto = view.findViewById(R.id.btnEliminarProducto);

        AgregarProducto.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                Navigation.findNavController(view).navigate(R.id.agregarProductos);
            }
        });


    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        binding = null;
    }*/
}