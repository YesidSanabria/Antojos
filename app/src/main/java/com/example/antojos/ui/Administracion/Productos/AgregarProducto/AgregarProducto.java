package com.example.antojos.ui.Administracion.Productos.AgregarProducto;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.fragment.app.Fragment;
import androidx.navigation.Navigation;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;

import com.android.volley.AuthFailureError;
import com.android.volley.Request;
import com.android.volley.RequestQueue;
import com.android.volley.Response;
import com.android.volley.VolleyError;
import com.android.volley.toolbox.StringRequest;
import com.android.volley.toolbox.Volley;
import com.example.antojos.R;

import java.util.HashMap;
import java.util.Map;

public class AgregarProducto extends Fragment {

    EditText editTextId,editTextNombre,editTextProveedor,editTextPrecioUnitario,editTextCantidadProductos;
    Button btnAgregarProductobd;

    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        return inflater.inflate(R.layout.fragment_agregar_productos,container,false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        EditText editTextId = (EditText) view.findViewById(R.id.editTextId);
        EditText editTextNombre = (EditText) view.findViewById(R.id.editTextNombre);
        EditText editTextProveedor = (EditText) view.findViewById(R.id.editTextProveedor);
        EditText editTextPrecioUnitario = (EditText) view.findViewById(R.id.editTextPrecioUnitario);
        EditText editTextCantidadProductos = (EditText) view.findViewById(R.id.editTextCantidadProductos);

        Button btnAgregarProductobd = (Button) view.findViewById(R.id.btnAgregarProductobd);

        btnAgregarProductobd.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                ejecutarServicio( "http//192.168.1.254:8080/developeru/insertar_producto.php");
            }
        });



    }

    //metodo que envia los datos al servidor
    private void ejecutarServicio(String URL){
        StringRequest stringRequest =  new StringRequest(Request.Method.POST, URL, new Response.Listener<String>() {
            @Override
            public void onResponse(String response) {
                Toast.makeText(getActivity().getApplicationContext(), "Producto agregado correctamente", Toast.LENGTH_SHORT).show();
            }
        }, new Response.ErrorListener() {
            @Override
            public void onErrorResponse(VolleyError error) {
                Toast.makeText(getActivity().getApplicationContext(),error.toString(), Toast.LENGTH_SHORT).show();
            }
        }){
            @Override
            protected Map<String, String> getParams() throws AuthFailureError {
                Map<String, String> parametros = new HashMap<String, String>();
                parametros.put("id",editTextId.getText().toString());
                parametros.put("id",editTextNombre.getText().toString());
                parametros.put("id",editTextProveedor.getText().toString());
                parametros.put("id",editTextPrecioUnitario.getText().toString());
                parametros.put("id",editTextCantidadProductos.getText().toString());
                return parametros;
            }
        };
        /*RequestQueue requestQueue = Volley.newRequestQueue(this);
        requestQueue.add(stringRequest);*/
    }
}